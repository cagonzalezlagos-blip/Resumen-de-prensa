// Resumen de Prensa - Vercel Serverless Function
// Búsqueda AM/PM en fuentes abiertas, sin dependencias externas.

const REGION_TERMS = [
  'valparaíso','valparaiso','viña del mar','vina del mar','quilpué','quilpue','villa alemana',
  'concón','concon','quintero','puchuncaví','puchuncavi','quillota','la calera','nogales','hijuelas',
  'limache','olmué','olmue','casablanca','san antonio','cartagena','el tabo','el quisco','algarrobo',
  'santo domingo','la ligua','cabildo','petorca','papudo','zapallar','los andes','san felipe','calle larga',
  'rinconada','panquehue','putaendo','catemu','llay-llay','rapa nui','isla de pascua','hanga roa',
  'juan fernández','juan fernandez','robinson crusoe'
];

const POLICE_TERMS = [
  'pdi','policía de investigaciones','policia de investigaciones','carabineros','fiscalía','fiscalia',
  'gendarmería','gendarmeria','homicidio','femicidio','parricidio','secuestro','robo','asalto','balacera',
  'arma de fuego','armas de fuego','drogas','narcotráfico','narcotrafico','microtráfico','microtrafico',
  'detenido','detenidos','detención','detencion','incautación','incautacion','allanamiento','crimen organizado',
  'sicario','prisión preventiva','prision preventiva','lavado de activos','tráfico de drogas','trafico de drogas',
  'orden de detención','orden de detencion','brigada investigadora','biro','bicrim','bh','mt0'
];

const REGIONAL_RELEVANCE = [
  'emergencia','incendio','inundación','inundacion','temporal','aluvión','aluvion','evacuación','evacuacion',
  'manifestación','manifestacion','protesta','marcha','huelga','paro','movilización','movilizacion','contaminación','contaminacion',
  'derrame','corte de agua','corte de energía','corte de energia','delegado presidencial','seremi','gobernador',
  'alcalde','alcaldesa','corrupción','corrupcion','fraude','cohecho','malversación','malversacion','seguridad',
  'municipalidad','concejo municipal','puerto','terminal','senapred'
];

const AUTOPISTA_TERMS = [
  'ruta 68','rutas del pacífico','rutas del pacifico','ruta 60 ch','ruta 60-ch','autopista los andes',
  'ruta 5 norte','autopista del aconcagua','ruta 62','camino troncal','ruta 66','carretera de la fruta'
];

const ROAD_OPERATION_TERMS = [
  'cierre','cerrada','cerrado','corte','interrupción','interrupcion','accidente','colisión','colision','choque','volcamiento',
  'congestión','congestion','alta congestión','alta congestion','restricción','restriccion','desvío','desvio','habilitada',
  'habilitado','reapertura','tránsito suspendido','transito suspendido','pista bloqueada','pistas bloqueadas','emergencia vial'
];

const PASO_TERMS = [
  'paso los libertadores','paso fronterizo los libertadores','complejo los libertadores',
  'sistema integrado cristo redentor','cristo redentor','alta montaña','alta montana'
];

const PASO_OPERATION_TERMS = [
  'abierto','abierta','cerrado','cerrada','cierre','habilitado','habilitada','suspendido','suspendida',
  'horario','restricción','restriccion','nieve','nevadas','viento','temporal','tránsito','transito','camiones','vehículos','vehiculos'
];

const NATIONAL_RELEVANCE = [
  'gobierno','presidente','presidencia','ministro','ministerio de seguridad','seguridad pública','seguridad publica','inteligencia',
  'fuerzas armadas','congreso','senado','cámara de diputados','camara de diputados','proyecto de ley','terrorismo',
  'atentado','frontera','crimen organizado','macrozona','homicidios','terremoto','tsunami','senapred','alerta roja',
  'incendio forestal','emergencia nacional','orden público','orden publico','subsecretaría del interior','subsecretaria del interior'
];

const CHILE_CONTEXT = [
  'chile','chileno','chilena','chilenos','chilenas','santiago','la moneda','senado de chile','cámara de diputados',
  'camara de diputados','carabineros de chile','pdi','policía de investigaciones','policia de investigaciones','senapred'
];

const CHILE_SOURCES = [
  'biobiochile','radio bío bío','radio bio bio','la tercera','emol','cooperativa','t13','24 horas','cnn chile',
  'mega noticias','meganoticias','chv noticias','the clinic','ex-ante','radio agricultura','diario constitucional',
  'pura noticia','puranoticia','g5 noticias','g5noticias','el observador','observador.cl','epicentro chile','epicentrochile',
  'soy valparaíso','soy valparaiso','el mercurio de valparaíso','el mercurio de valparaiso','pdi chile','carabineros de chile'
];

const FOREIGN_CONTEXT = [
  'mendoza','argentina','buenos aires','perú','peru','bolivia','uruguay','paraguay','méxico','mexico','españa','espana',
  'estados unidos','ee. uu.','brasil','colombia','venezuela'
];

const LOW_VALUE = [
  'cartelera','panorama','receta','horóscopo','horoscopo','festival gastronómico','festival gastronomico',
  'concierto','estreno de película','estreno de pelicula','televisión','television','farándula','farandula',
  'partido de fútbol','partido de futbol','campeonato','deportes','espectáculos','espectaculos'
];

const TITLE_NOISE = [
  'estado del tiempo y pasos internacionales','pronóstico del tiempo','pronostico del tiempo','efemérides','efemerides'
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
function stripSourceSuffix(title, source='') {
  let t=clean(title);
  const s=clean(source);
  if (s) {
    const escaped=s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    t=t.replace(new RegExp(`\\s*[-–—|]\\s*${escaped}\\s*$`,'i'),'').trim();
  }
  return t;
}
function similarity(a,b) {
  const A=new Set(norm(a).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  const B=new Set(norm(b).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  if (!A.size || !B.size) return 0;
  let inter=0; for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size,B.size);
}
function usableSummary(title, raw, source='') {
  let s=clean(raw);
  const t=clean(title);
  const src=clean(source);
  if (!s) return '';

  // Quita repeticiones frecuentes del titular y del nombre de la fuente.
  if (similarity(t,s) > 0.82 || norm(s)===norm(t) || norm(s)===norm(`${t} ${src}`)) return '';
  if (s.length < 45) return '';

  // Elimina prefijos del tipo "Titular - Fuente" cuando vienen pegados al resumen.
  if (norm(s).startsWith(norm(t))) s=s.slice(t.length).replace(/^\s*[-–—:|]\s*/,'').trim();
  if (src && norm(s).endsWith(norm(src))) s=s.slice(0,Math.max(0,s.length-src.length)).replace(/[\s\-–—|]+$/,'').trim();
  if (similarity(t,s) > 0.82 || s.length < 45) return '';

  // Mantiene una extensión adecuada para WhatsApp.
  if (s.length > 520) {
    s=s.slice(0,520);
    const cut=Math.max(s.lastIndexOf('. '),s.lastIndexOf('; '),s.lastIndexOf(', '));
    if (cut>220) s=s.slice(0,cut+1);
    else s=s.replace(/\s+\S*$/,'')+'…';
  }
  return s;
}
function fallbackSummary(title, category, source='') {
  const t=stripSourceSuffix(title,source);
  const lower=norm(t);
  if (category==='paso') return `La fuente reporta una actualización sobre la operación del Paso Fronterizo Los Libertadores. Revisa el enlace para confirmar la vigencia, horario y eventuales restricciones antes de difundir.`;
  if (category==='autopistas') return `La fuente reporta una novedad operacional en una de las rutas de interés para la Región de Valparaíso. Revisa el enlace para confirmar ubicación, sentido de tránsito y vigencia antes de difundir.`;
  if (category==='police') return `La fuente informa un procedimiento o hecho policial de interés en la Región de Valparaíso. Revisa el enlace de origen para confirmar las circunstancias y antecedentes disponibles antes de difundir.`;
  if (category==='regional') return `La fuente reporta un hecho de interés regional relacionado con ${t.charAt(0).toLowerCase()+t.slice(1)}. Se recomienda verificar el antecedente completo en el enlace de origen.`;
  return `La fuente informa un hecho de interés nacional relacionado con ${t.charAt(0).toLowerCase()+t.slice(1)}. Se recomienda revisar el antecedente completo en el enlace de origen antes de su difusión.`;
}
function score(text, category, hint) {
  let s=0;
  if (category==='police' && hasAny(text,POLICE_TERMS)) s+=7;
  if (category==='regional' && hasAny(text,REGION_TERMS)) s+=5;
  if (category==='regional' && hasAny(text,REGIONAL_RELEVANCE)) s+=2;
  if (category==='national' && hasAny(text,NATIONAL_RELEVANCE)) s+=4;
  if (category==='national' && hasAny(text,CHILE_CONTEXT)) s+=3;
  if (category==='autopistas' && hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS)) s+=9;
  if (category==='paso' && hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS)) s+=9;
  if (hint===category) s+=1;
  if (hasAny(text,['homicidio','secuestro','atentado','fallecido','muerto','heridos','alerta roja','evacuación','evacuacion'])) s+=1;
  if (hasAny(text,LOW_VALUE)) s-=7;
  if (hasAny(text,TITLE_NOISE) && !hasAny(text,REGION_TERMS) && !hasAny(text,PASO_TERMS)) s-=8;
  return s;
}
function classify(text, hint='national') {
  if (hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS)) return 'paso';
  if (hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS)) return 'autopistas';
  const regional=hasAny(text,REGION_TERMS);
  const police=hasAny(text,POLICE_TERMS);
  if (regional && police) return 'police';
  if (regional) return 'regional';
  if (hint==='police' && police && hasAny(text,CHILE_CONTEXT)) return 'police';
  return 'national';
}
function isRelevantForCategory(text, category) {
  if (category==='national') {
    const chile=hasAny(text,CHILE_CONTEXT);
    const foreign=hasAny(text,FOREIGN_CONTEXT);
    const chileSource=hasAny(text,CHILE_SOURCES);
    if (!chile && !chileSource) return false;
    if (foreign && !hasAny(text,['paso los libertadores','cristo redentor','frontera chile argentina'])) return false;
    return hasAny(text,NATIONAL_RELEVANCE) || hasAny(text,POLICE_TERMS);
  }
  if (category==='regional') return hasAny(text,REGION_TERMS) && hasAny(text,REGIONAL_RELEVANCE);
  if (category==='police') return hasAny(text,REGION_TERMS) && hasAny(text,POLICE_TERMS);
  if (category==='autopistas') return hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS);
  if (category==='paso') return hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS);
  return false;
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
    const title=stripSourceSuffix(rawTitle,source).slice(0,220);
    const text=`${title} ${rawSummary} ${source}`;
    const category=classify(text,hint);
    if (!isRelevantForCategory(text,category)) return null;
    const sc=score(text,category,hint);
    if (sc<3) return null;
    const goodSummary=usableSummary(title,rawSummary,source);
    const summary=goodSummary || fallbackSummary(title,category,source);
    return {
      title,
      summary,
      url:link,
      source,
      published:published.toISOString(),
      category,
      relevance:sc>=8?'high':sc>=5?'medium':'low',
      included:sc>=5,
      provider,
      summaryQuality:goodSummary?'source':'fallback'
    };
  }).filter(Boolean);
}
function metaContent(html, key, value) {
  const patterns = [
    new RegExp(`<meta[^>]+${key}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${key}=["']${value}["'][^>]*>`, 'i')
  ];
  for (const re of patterns) {
    const m=html.match(re);
    if (m) return clean(m[1]);
  }
  return '';
}
function canonicalLink(html) {
  const m=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
          html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m ? decodeXml(m[1]) : '';
}
async function enrichItem(item) {
  if (!item.url) return item;
  const needsSummary=item.summaryQuality!=='source';
  const needsUrl=/news\.google\.com|bing\.com/i.test(item.url);
  if (!needsSummary && !needsUrl) return item;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),4500);
  try {
    const r=await fetch(item.url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/2.0)','accept':'text/html,application/xhtml+xml'},signal:ctrl.signal,redirect:'follow'});
    if (!r.ok) return item;
    const html=await r.text();
    const desc=metaContent(html,'property','og:description') || metaContent(html,'name','description') || metaContent(html,'name','twitter:description');
    const resolved=canonicalLink(html) || r.url || item.url;
    const better=usableSummary(item.title,desc,item.source);
    return {
      ...item,
      url: resolved && !/news\.google\.com\/rss\//i.test(resolved) ? resolved : item.url,
      summary: better || item.summary,
      summaryQuality: better ? 'source' : item.summaryQuality
    };
  } catch { return item; }
  finally { clearTimeout(timer); }
}
async function enrichItems(items, limit=24) {
  const selected=items.slice(0,limit);
  const enriched=await Promise.all(selected.map(enrichItem));
  return [...enriched, ...items.slice(limit)];
}

function google(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=CL&ceid=CL:es-419`;
}
function bing(q) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&setmkt=es-CL&format=RSS`;
}
async function fetchFeed(url,hint,provider) {
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),7000);
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/2.0)','accept':'application/rss+xml,application/xml,text/xml,*/*'},signal:ctrl.signal,redirect:'follow'});
    if (!r.ok) return [];
    return parseFeed(await r.text(),hint,provider);
  } catch { return []; }
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
    // Nacional: seguridad, autoridades, orden público, emergencias e inteligencia.
    ['national',`Chile seguridad pública PDI Carabineros Fiscalía crimen organizado homicidios Gobierno Congreso inteligencia${dc}`],
    ['national',`Chile terrorismo atentado frontera orden público Fuerzas Armadas SENAPRED alerta roja emergencia${dc}`],
    ['national',`Chile Ministerio de Seguridad Subsecretaría del Interior seguridad autoridades policial${dc}`],

    // Regional: consultas más acotadas para aumentar cobertura real.
    ['regional',`Valparaíso "Viña del Mar" Quilpué "Villa Alemana" Concón emergencia protesta autoridad seguridad${dc}`],
    ['regional',`Quintero Puchuncaví Quillota Limache "La Calera" seguridad emergencia municipalidad protesta${dc}`],
    ['regional',`"San Antonio" Cartagena "El Tabo" "El Quisco" Algarrobo "Santo Domingo" seguridad emergencia${dc}`],
    ['regional',`"Los Andes" "San Felipe" "La Ligua" Petorca Cabildo seguridad emergencia autoridad${dc}`],
    ['regional',`"Rapa Nui" "Isla de Pascua" "Hanga Roa" seguridad emergencia aeropuerto tsunami temporal${dc}`],
    ['regional',`"Juan Fernández" "Robinson Crusoe" emergencia seguridad temporal${dc}`],

    // Policial regional con énfasis PDI.
    ['police',`Valparaíso PDI "Policía de Investigaciones" detenido homicidio robo drogas arma${dc}`],
    ['police',`"Viña del Mar" PDI Carabineros Fiscalía homicidio robo drogas detenido${dc}`],
    ['police',`Quilpué "Villa Alemana" Concón PDI Carabineros Fiscalía homicidio robo drogas${dc}`],
    ['police',`Quillota "San Antonio" "Los Andes" "San Felipe" PDI Carabineros Fiscalía${dc}`],

    // Fuentes regionales conocidas.
    ['regional',`site:observador.cl Valparaíso seguridad policial emergencia${dc}`],
    ['regional',`site:puranoticia.pnt.cl Valparaíso seguridad policial emergencia${dc}`],
    ['regional',`site:g5noticias.cl Valparaíso seguridad policial emergencia${dc}`],
    ['regional',`site:epicentrochile.com Valparaíso seguridad policial emergencia${dc}`],
    ['regional',`site:biobiochile.cl Valparaíso seguridad policial emergencia${dc}`],
    ['regional',`site:soyvalparaiso.cl seguridad policial emergencia${dc}`],

    // Autopistas: solo novedades operativas.
    ['autopistas',`"Ruta 68" accidente cierre congestión desvío reapertura${dc}`],
    ['autopistas',`"Ruta 60 CH" OR "Autopista Los Andes" accidente cierre congestión restricción${dc}`],
    ['autopistas',`"Ruta 5 Norte" OR "Autopista del Aconcagua" accidente cierre congestión${dc}`],
    ['autopistas',`"Ruta 62" OR "Camino Troncal" accidente cierre congestión${dc}`],
    ['autopistas',`"Ruta 66" OR "Carretera de la Fruta" accidente cierre congestión${dc}`],

    // Paso fronterizo.
    ['paso',`"Paso Los Libertadores" abierto cerrado cierre nieve viento tránsito${dc}`],
    ['paso',`"Complejo Los Libertadores" horario habilitado suspendido camiones${dc}`],
    ['paso',`"Sistema Integrado Cristo Redentor" Chile abierto cerrado nieve${dc}`]
  ];
}
function titleKey(title='') {
  const stop=new Set(['para','desde','sobre','entre','ante','tras','este','esta','estos','estas','chile','region','valparaiso','noticia','hoy','ayer','dice','segun']);
  return norm(title).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>3&&!stop.has(w)).slice(0,14).join('|');
}
function sameEvent(a,b) {
  if (a.category!==b.category) return false;
  const sa=titleKey(a.title), sb=titleKey(b.title);
  if (!sa || !sb) return false;
  return similarity(sa.replace(/\|/g,' '),sb.replace(/\|/g,' ')) >= 0.58;
}
function dedupe(items) {
  const out=[];
  const rank=x=>(x.relevance==='high'?3:x.relevance==='medium'?2:1)+(x.summaryQuality==='source'?0.5:0)+(x.source?0.1:0);
  for (const x of items) {
    const idx=out.findIndex(y=>sameEvent(x,y));
    if (idx===-1) out.push(x);
    else if (rank(x)>rank(out[idx])) out[idx]=x;
  }
  return out;
}

module.exports = async function handler(req,res) {
  if (req.method!=='GET') return res.status(405).json({error:'Método no permitido'});
  try {
    const start=new Date(req.query.start);
    const end=new Date(req.query.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start>=end) {
      return res.status(400).json({error:'Rango de fechas inválido'});
    }

    const defs=queries(start,end);
    const jobs=[];
    for (const [hint,q] of defs) {
      jobs.push(fetchFeed(google(q),hint,'Google News'));
      // Bing complementa consultas claves para mejorar cobertura sin exceder el tiempo de ejecución.
      if (['national','police','regional'].includes(hint) && jobs.length<30) jobs.push(fetchFeed(bing(q),hint,'Bing News'));
    }

    const batches=await Promise.all(jobs);
    const parsed=batches.flat();
    let news=parsed.filter(x=>{
      const d=new Date(x.published);
      return d>=start && d<=end;
    });

    // Primero ordena por relevancia para enriquecer solo los resultados más útiles.
    news=news.sort((a,b)=>{
      const r=x=>x.relevance==='high'?3:x.relevance==='medium'?2:1;
      return (r(b)-r(a)) || (new Date(b.published)-new Date(a.published));
    });
    news=await enrichItems(news,24);

    // Los textos sin descripción real quedan visibles para revisión, pero no se seleccionan automáticamente.
    news=news.map(x=>x.summaryQuality==='source' ? x : {...x,included:false,relevance:x.relevance==='high'?'medium':x.relevance});

    news=dedupe(news).sort((a,b)=>{
      const r=x=>x.relevance==='high'?3:x.relevance==='medium'?2:1;
      return (r(b)-r(a)) || (new Date(b.published)-new Date(a.published));
    }).slice(0,120);

    res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=240');
    return res.status(200).json({
      news,
      count:news.length,
      start:start.toISOString(),
      end:end.toISOString(),
      diagnostics:{
        feedsConsulted:jobs.length,
        parsed:parsed.length,
        inPeriod:news.length,
        categories:news.reduce((acc,x)=>{acc[x.category]=(acc[x.category]||0)+1; return acc;},{})
      }
    });
  } catch (e) {
    return res.status(500).json({
      error:'No fue posible consultar noticias',
      detail:String(e && e.message ? e.message : e)
    });
  }
};
