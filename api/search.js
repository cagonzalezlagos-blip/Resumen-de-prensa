// Resumen de Prensa V5 - Vercel Serverless Function
// Búsqueda AM/PM en fuentes abiertas, con filtros, enriquecimiento y deduplicación.

const REGION_TERMS = [
  'valparaíso','valparaiso','viña del mar','vina del mar','quilpué','quilpue','villa alemana',
  'concón','concon','quintero','puchuncaví','puchuncavi','quillota','la calera','nogales','hijuelas',
  'limache','olmué','olmue','casablanca','san antonio','cartagena','el tabo','el quisco','algarrobo',
  'santo domingo','la ligua','cabildo','petorca','papudo','zapallar','los andes','san felipe','calle larga',
  'rinconada','panquehue','putaendo','catemu','llay-llay','rapa nui','isla de pascua','hanga roa',
  'juan fernández','juan fernandez','robinson crusoe'
];

const POLICE_STRONG_TERMS = [
  'pdi','policía de investigaciones','policia de investigaciones','carabineros','fiscalía','fiscalia',
  'gendarmería','gendarmeria','brigada investigadora','brigada de homicidios','brigada investigadora de robos',
  'bicrim','biro','mt0','detenido','detenidos','detención','detencion','allanamiento','incautación','incautacion',
  'orden de detención','orden de detencion','prisión preventiva','prision preventiva','ministerio público','ministerio publico',
  'homicidio','femicidio','parricidio','secuestro','asalto','balacera','arma de fuego','armas de fuego',
  'narcotráfico','narcotrafico','microtráfico','microtrafico','tráfico de drogas','trafico de drogas','crimen organizado',
  'sicario','lavado de activos'
];

const POLICE_WEAK_TERMS = ['robo','drogas','droga','agresión','agresion','delito','delincuencia','violencia'];

const REGIONAL_RELEVANCE = [
  'emergencia','incendio','inundación','inundacion','temporal','aluvión','aluvion','evacuación','evacuacion',
  'manifestación','manifestacion','protesta','marcha','huelga','paro','movilización','movilizacion','contaminación','contaminacion',
  'derrame','corte de agua','corte de energía','corte de energia','delegado presidencial','seremi','gobernador',
  'alcalde','alcaldesa','corrupción','corrupcion','fraude','cohecho','malversación','malversacion','seguridad',
  'municipalidad','concejo municipal','puerto','terminal','senapred','enap','transporte público','transporte publico',
  'locomoción colectiva','locomocion colectiva','fiscalización','fiscalizacion','salud pública','salud publica'
];

const AUTOPISTA_TERMS = [
  'ruta 68','rutas del pacífico','rutas del pacifico','ruta 60 ch','ruta 60-ch','autopista los andes',
  'ruta 5 norte','autopista del aconcagua','ruta 62','camino troncal','ruta 66','carretera de la fruta'
];

const ROAD_OPERATION_TERMS = [
  'cierre','cerrada','cerrado','corte','interrupción','interrupcion','accidente','colisión','colision','choque',
  'volcamiento','congestión','congestion','restricción','restriccion','desvío','desvio','habilitada','habilitado',
  'reapertura','tránsito suspendido','transito suspendido','pista bloqueada','pistas bloqueadas','emergencia vial'
];

const PASO_TERMS = [
  'paso los libertadores','paso fronterizo los libertadores','complejo los libertadores',
  'sistema integrado cristo redentor','cristo redentor'
];

const PASO_OPERATION_TERMS = [
  'abierto','abierta','cerrado','cerrada','cierre','habilitado','habilitada','suspendido','suspendida',
  'horario','restricción','restriccion','nieve','nevadas','viento','temporal','tránsito','transito',
  'camiones','vehículos','vehiculos','funcionamiento','apertura','reabre','reabierto','operativo','operativa'
];

const NATIONAL_RELEVANCE = [
  'gobierno','presidente','presidencia','ministro','ministerio de seguridad','seguridad pública','seguridad publica',
  'inteligencia','fuerzas armadas','congreso','senado','cámara de diputados','camara de diputados','proyecto de ley',
  'terrorismo','atentado','frontera','crimen organizado','macrozona','homicidios','terremoto','tsunami','senapred',
  'alerta roja','incendio forestal','emergencia nacional','orden público','orden publico','subsecretaría del interior',
  'subsecretaria del interior','estado de excepción','estado de excepcion'
];

const CHILE_CONTEXT = [
  'chile','chileno','chilena','chilenos','chilenas','santiago','la moneda','senado de chile','cámara de diputados',
  'camara de diputados','carabineros de chile','pdi','policía de investigaciones','policia de investigaciones','senapred'
];

const FOREIGN_CONTEXT = [
  'mendoza','argentina','buenos aires','perú','peru','bolivia','uruguay','paraguay','méxico','mexico',
  'españa','espana','estados unidos','ee. uu.','brasil','colombia','venezuela'
];

const LOW_VALUE = [
  'cartelera','panorama','receta','horóscopo','horoscopo','festival gastronómico','festival gastronomico',
  'concierto','estreno','televisión','television','farándula','farandula','partido de fútbol','partido de futbol',
  'campeonato','deportes','espectáculos','espectaculos','lotería','loteria','kino','polla gol'
];

const GENERIC_SUMMARY = [
  'comprehensive up-to-date news coverage','aggregated from sources all over the world by google news',
  'google news','latest news and headlines','noticias de última hora','noticias de ultima hora'
];

function norm(s='') {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function hasAny(s, arr) { const n=norm(s); return arr.some(x=>n.includes(norm(x))); }
function decodeXml(s='') {
  return String(s)
    .replace(/<!\[CDATA\[|\]\]>/g,'')
    .replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x)))
    .replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16)))
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function clean(s='') {
  return decodeXml(s)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s+([,.;:!?])/g,'$1')
    .trim();
}
function tag(block,name) {
  const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return m ? decodeXml(m[1]).trim() : '';
}
function sourceFrom(link, explicit='') {
  const e=clean(explicit);
  if (e) return e;
  try { return new URL(link).hostname.replace(/^www\./,''); } catch { return ''; }
}
function stripSourceSuffix(title,source='') {
  let t=clean(title);
  const s=clean(source);
  if (s) {
    const escaped=s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    t=t.replace(new RegExp(`\\s*[-–—|]\\s*${escaped}\\s*$`,'i'),'').trim();
  }
  return t.replace(/\s+[-–—|]\s+[^-–—|]{2,50}$/,'').trim();
}
function similarity(a,b) {
  const A=new Set(norm(a).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  const B=new Set(norm(b).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  if (!A.size || !B.size) return 0;
  let inter=0; for (const w of A) if (B.has(w)) inter++;
  return inter/Math.max(A.size,B.size);
}
function usableSummary(title,raw,source='') {
  let s=clean(raw);
  const t=clean(title), src=clean(source);
  if (!s || s.length<60 || hasAny(s,GENERIC_SUMMARY)) return '';
  if (similarity(t,s)>0.76 || norm(s)===norm(t)) return '';
  if (norm(s).startsWith(norm(t))) s=s.slice(t.length).replace(/^\s*[-–—:|]\s*/,'').trim();
  if (src && norm(s).endsWith(norm(src))) s=s.slice(0,Math.max(0,s.length-src.length)).replace(/[\s\-–—|]+$/,'').trim();
  if (!s || s.length<60 || hasAny(s,GENERIC_SUMMARY) || similarity(t,s)>0.76) return '';
  s=s.replace(/\s*\.\.\.\s*$/,'…').trim();
  if (s.length>620) {
    s=s.slice(0,620);
    const cut=Math.max(s.lastIndexOf('. '),s.lastIndexOf('; '),s.lastIndexOf(', '));
    s=cut>260?s.slice(0,cut+1):s.replace(/\s+\S*$/,'')+'…';
  }
  return s;
}
function strongPolice(text) {
  return hasAny(text,POLICE_STRONG_TERMS) || (hasAny(text,POLICE_WEAK_TERMS) && hasAny(text,['detenido','carabineros','pdi','fiscalía','fiscalia','brigada']));
}
function classify(text,hint='national') {
  if (hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS)) return 'paso';
  if (hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS)) return 'autopistas';
  const regional=hasAny(text,REGION_TERMS);
  const police=strongPolice(text);
  if (regional && police) return 'police';
  if (regional) return 'regional';
  return 'national';
}
function relevant(text,category) {
  if (hasAny(text,LOW_VALUE)) return false;
  if (category==='national') {
    const foreign=hasAny(text,FOREIGN_CONTEXT);
    const chile=hasAny(text,CHILE_CONTEXT);
    if (!chile) return false;
    if (foreign && !hasAny(text,['paso los libertadores','cristo redentor','frontera chile argentina'])) return false;
    return hasAny(text,NATIONAL_RELEVANCE) || strongPolice(text);
  }
  if (category==='regional') return hasAny(text,REGION_TERMS) && (hasAny(text,REGIONAL_RELEVANCE) || hasAny(text,POLICE_WEAK_TERMS));
  if (category==='police') return hasAny(text,REGION_TERMS) && strongPolice(text);
  if (category==='autopistas') return hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS);
  if (category==='paso') return hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS);
  return false;
}
function score(text,category,hint,hasSummary=false,directUrl=false) {
  let s=0;
  if (category==='police') s+=8;
  if (category==='regional') s+=6;
  if (category==='national') s+=hasAny(text,NATIONAL_RELEVANCE)?6:4;
  if (category==='autopistas' || category==='paso') s+=9;
  if (hint===category) s+=1;
  if (hasSummary) s+=2;
  if (directUrl) s+=1;
  if (hasAny(text,['homicidio','secuestro','atentado','fallecido','muerto','heridos','alerta roja','evacuación','evacuacion'])) s+=1;
  return s;
}
function parseFeed(xml,hint,provider) {
  const blocks=xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block=>{
    const rawTitle=clean(tag(block,'title'));
    const rawSummary=clean(tag(block,'description')) || clean(tag(block,'summary')) || clean(tag(block,'content'));
    let link=clean(tag(block,'link'));
    if (!link) {
      const m=block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (m) link=decodeXml(m[1]);
    }
    const rawDate=clean(tag(block,'pubDate')) || clean(tag(block,'published')) || clean(tag(block,'updated'));
    const published=new Date(rawDate);
    if (!rawTitle || Number.isNaN(published.getTime())) return null;
    const source=sourceFrom(link,tag(block,'source'));
    const title=stripSourceSuffix(rawTitle,source).slice(0,260);
    const text=`${title} ${rawSummary} ${source}`;
    const category=classify(text,hint);
    if (!relevant(text,category)) return null;
    const summary=usableSummary(title,rawSummary,source);
    return {title,summary,url:link,source,published:published.toISOString(),category,hint,provider};
  }).filter(Boolean);
}
function google(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=CL&ceid=CL:es-419`;
}
function bing(q) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&setmkt=es-CL&format=RSS`;
}
async function fetchFeed(url,hint,provider) {
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),6500);
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/5.0)','accept':'application/rss+xml,application/xml,text/xml,*/*'},signal:ctrl.signal,redirect:'follow'});
    if (!r.ok) return [];
    return parseFeed(await r.text(),hint,provider);
  } catch { return []; }
  finally { clearTimeout(timer); }
}
function metaContent(html,attr,name) {
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const a=new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,'i');
  const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`,'i');
  const m=html.match(a)||html.match(b);
  return m?clean(m[1]):'';
}
function canonicalLink(html) {
  const m=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
          html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return m?decodeXml(m[1]).trim():'';
}
function isDirectSourceUrl(url='') {
  try { return !/news\.google\.com|bing\.com\/news/i.test(new URL(url).hostname+new URL(url).pathname); } catch { return false; }
}
async function enrichItem(item) {
  if (!item.url) return item;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),4800);
  try {
    const r=await fetch(item.url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/5.0)','accept':'text/html,application/xhtml+xml'},signal:ctrl.signal,redirect:'follow'});
    if (!r.ok) return item;
    const html=await r.text();
    const finalUrl=r.url||item.url;
    const canonical=canonicalLink(html)||finalUrl;
    const ogTitle=metaContent(html,'property','og:title') || metaContent(html,'name','twitter:title');
    const ogDesc=metaContent(html,'property','og:description') || metaContent(html,'name','description') || metaContent(html,'name','twitter:description');
    const direct=isDirectSourceUrl(canonical);
    const candidateTitle=direct && ogTitle ? stripSourceSuffix(ogTitle,item.source) : item.title;
    const candidateSummary=usableSummary(candidateTitle,ogDesc,item.source) || item.summary;
    let source=item.source;
    if (direct) {
      try { source=new URL(canonical).hostname.replace(/^www\./,''); } catch {}
    }
    return {...item,title:candidateTitle||item.title,summary:candidateSummary,url:direct?canonical:item.url,source,direct};
  } catch { return item; }
  finally { clearTimeout(timer); }
}
function dateClause(start,end) {
  const a=new Date(start), b=new Date(end);
  const ymd=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  const before=new Date(b.getTime()+24*60*60*1000);
  return ` after:${ymd(a)} before:${ymd(before)}`;
}
function queries(start,end) {
  const dc=dateClause(start,end);
  return [
    ['national',`Chile (seguridad OR "crimen organizado" OR inteligencia OR atentado OR terrorismo OR emergencia)${dc}`],
    ['national',`Chile (Gobierno OR Congreso OR Senado OR ministro) (seguridad OR "orden público" OR emergencia)${dc}`],
    ['national',`Chile (SENAPRED OR "incendio forestal" OR terremoto OR tsunami OR "alerta roja")${dc}`],

    ['regional',`Valparaíso (emergencia OR protesta OR municipalidad OR autoridad OR seguridad OR contaminación OR paro)${dc}`],
    ['regional',`"Viña del Mar" (emergencia OR protesta OR municipalidad OR autoridad OR seguridad)${dc}`],
    ['regional',`(Quilpué OR "Villa Alemana" OR Concón) (emergencia OR seguridad OR municipalidad OR protesta OR ENAP)${dc}`],
    ['regional',`(Quillota OR Limache OR "La Calera" OR Quintero OR Puchuncaví) (emergencia OR seguridad OR municipalidad OR protesta)${dc}`],
    ['regional',`("San Antonio" OR "Los Andes" OR "San Felipe" OR "La Ligua") (emergencia OR seguridad OR municipalidad OR protesta)${dc}`],
    ['regional',`("Rapa Nui" OR "Isla de Pascua" OR "Hanga Roa") (emergencia OR seguridad OR contingencia OR autoridad)${dc}`],

    ['police',`Valparaíso (PDI OR Carabineros OR Fiscalía OR homicidio OR secuestro OR detenido OR balacera OR narcotráfico)${dc}`],
    ['police',`"Viña del Mar" (PDI OR Carabineros OR Fiscalía OR homicidio OR detenido OR robo OR drogas)${dc}`],
    ['police',`(Quilpué OR "Villa Alemana" OR Concón OR Quillota OR "La Ligua") (PDI OR Carabineros OR Fiscalía OR detenido OR homicidio OR narcotráfico)${dc}`],
    ['police',`site:pdi.cl Valparaíso${dc}`],
    ['police',`site:biobiochile.cl Valparaíso (PDI OR Carabineros OR Fiscalía)${dc}`],
    ['police',`site:cooperativa.cl Valparaíso (PDI OR Carabineros OR Fiscalía)${dc}`],
    ['regional',`site:puranoticia.pnt.cl Valparaíso${dc}`],
    ['regional',`site:g5noticias.cl Valparaíso${dc}`],
    ['regional',`site:observador.cl Valparaíso${dc}`],

    ['autopistas',`"Ruta 68" (cierre OR accidente OR congestión OR desvío OR reapertura)${dc}`],
    ['autopistas',`("Ruta 60 CH" OR "Autopista Los Andes") (cierre OR accidente OR congestión OR desvío)${dc}`],
    ['autopistas',`("Ruta 5 Norte" OR "Autopista del Aconcagua") (cierre OR accidente OR congestión OR desvío)${dc}`],
    ['autopistas',`("Ruta 62" OR "Camino Troncal" OR "Ruta 66") (cierre OR accidente OR congestión OR desvío)${dc}`],

    ['paso',`"Paso Los Libertadores" (abierto OR cerrado OR cierre OR habilitado OR nieve OR viento OR tránsito OR horario)${dc}`],
    ['paso',`("Complejo Los Libertadores" OR "Cristo Redentor") (abierto OR cerrado OR habilitado OR tránsito OR horario)${dc}`]
  ];
}
function keyWords(title='') {
  const stop=new Set(['para','desde','sobre','entre','ante','tras','este','esta','estos','estas','chile','region','valparaiso','noticia','hoy','dice','segun','informo','informan','nuevo','nueva']);
  return norm(title).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>3&&!stop.has(w)).slice(0,14);
}
function sameEvent(a,b) {
  const A=new Set(keyWords(a.title)),B=new Set(keyWords(b.title));
  if (!A.size||!B.size) return false;
  let inter=0; for (const w of A) if (B.has(w)) inter++;
  return inter/Math.min(A.size,B.size)>=0.56;
}
function quality(item) {
  let q=0;
  if (item.summary) q+=5;
  if (item.direct||isDirectSourceUrl(item.url)) q+=3;
  if (item.provider==='Bing News') q+=1;
  if (item.title && item.title.length>=45) q+=1;
  if (item.title && item.title.length<=220) q+=1;
  return q;
}
function dedupe(items) {
  const out=[];
  for (const x of items) {
    const idx=out.findIndex(y=>sameEvent(x,y));
    if (idx<0) out.push(x);
    else if (quality(x)>quality(out[idx])) out[idx]=x;
  }
  return out;
}

function titleSummary(title,category) {
  const t=clean(title).replace(/[.]+$/,'').trim();
  if (!t) return '';
  let s=t;
  // Convierte titulares frecuentes a una oración más natural sin inventar antecedentes.
  s=s.replace(/^PDI\s+/i,'La PDI ');
  s=s.replace(/^Carabineros\s+/i,'Carabineros ');
  s=s.replace(/^Fiscalía\s+/i,'La Fiscalía ');
  s=s.replace(/^Gobierno\s+/i,'El Gobierno ');
  s=s.replace(/^CONAF\s+/i,'CONAF ');
  s=s.replace(/^Senapred\s+/i,'Senapred ');
  s=s.charAt(0).toUpperCase()+s.slice(1);
  if (!/[.!?]$/.test(s)) s+='.';
  return s;
}

function suspiciousTitle(t='') {
  const s=clean(t);
  if (!s || s.length<20) return true;
  if (/\b(cuestionad|investigad|detenid|afectad|anunciad|confirmad|denunciad)$/i.test(s)) return true;
  return false;
}

module.exports=async function handler(req,res) {
  if (req.method!=='GET') return res.status(405).json({error:'Método no permitido'});
  try {
    const start=new Date(req.query.start),end=new Date(req.query.end);
    if (Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>=end) return res.status(400).json({error:'Rango de fechas inválido'});

    const defs=queries(start,end),jobs=[];
    for (const [hint,q] of defs) {
      jobs.push(fetchFeed(google(q),hint,'Google News'));
      if (['national','regional','police'].includes(hint)) jobs.push(fetchFeed(bing(q),hint,'Bing News'));
    }
    const batches=await Promise.all(jobs);
    let parsed=batches.flat().filter(x=>{const d=new Date(x.published);return d>=start&&d<=end;});

    // Deduplicación preliminar para no enriquecer decenas de copias del mismo hecho.
    parsed=dedupe(parsed).slice(0,70);

    // Enriquecimiento limitado y concurrente: intenta obtener título, descripción y URL directa del medio.
    const enriched=await Promise.all(parsed.map(enrichItem));

    let news=dedupe(enriched).map(x=>{
      const text=`${x.title} ${x.summary||''} ${x.source||''}`;
      const category=classify(text,x.hint);
      if (!relevant(text,category)) return null;
      const direct=!!x.direct||isDirectSourceUrl(x.url);
      const sc=score(text,category,x.hint,!!x.summary,direct);
      const title=stripSourceSuffix(x.title,x.source).trim();
      const badTitle=suspiciousTitle(title);
      const summary=x.summary||titleSummary(title,category);
      return {
        title,
        summary,
        url:x.url,
        source:x.source,
        published:x.published,
        category,
        relevance:sc>=10?'high':sc>=7?'medium':'low',
        included:false,
        scoreValue:sc,
        summaryVerified:!!x.summary,
        titleVerified:!badTitle,
        provider:x.provider
      };
    }).filter(Boolean);

    news=news.sort((a,b)=>{
      const r=x=>x.relevance==='high'?3:x.relevance==='medium'?2:1;
      return (r(b)-r(a))||(b.scoreValue-a.scoreValue)||(new Date(b.published)-new Date(a.published));
    }).slice(0,120);

    // Preselección equilibrada: prioriza relevancia, evita saturar el informe
    // y deja el resto disponible para revisión manual.
    const quotas={national:6,regional:6,police:8,autopistas:3,paso:3};
    const used={national:0,regional:0,police:0,autopistas:0,paso:0};
    news=news.map(x=>{
      const eligible=x.titleVerified && x.relevance!=='low' && x.scoreValue>=7;
      if (eligible && used[x.category] < (quotas[x.category]||0)) {
        x.included=true;
        used[x.category]++;
      }
      delete x.scoreValue;
      return x;
    });

    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    return res.status(200).json({
      news,count:news.length,start:start.toISOString(),end:end.toISOString(),version:'5.0',
      diagnostics:{feedsConsulted:jobs.length,raw:batches.flat().length,inPeriod:parsed.length,enriched:enriched.length,final:news.length}
    });
  } catch(e) {
    return res.status(500).json({error:'No fue posible consultar noticias',detail:String(e&&e.message?e.message:e)});
  }
};
