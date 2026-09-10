// Resumen de Prensa V3 - Vercel Serverless Function
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
  'orden de detención','orden de detencion','brigada investigadora','biro','bicrim','brigada de homicidios',
  'brigada investigadora de robos','mt0','ministerio público','ministerio publico'
];

const REGIONAL_RELEVANCE = [
  'emergencia','incendio','inundación','inundacion','temporal','aluvión','aluvion','evacuación','evacuacion',
  'manifestación','manifestacion','protesta','marcha','huelga','paro','movilización','movilizacion','contaminación','contaminacion',
  'derrame','corte de agua','corte de energía','corte de energia','delegado presidencial','seremi','gobernador',
  'alcalde','alcaldesa','corrupción','corrupcion','fraude','cohecho','malversación','malversacion','seguridad',
  'municipalidad','concejo municipal','puerto','terminal','senapred','enap','salud pública','salud publica'
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
  'camiones','vehículos','vehiculos','funcionamiento'
];

const NATIONAL_RELEVANCE = [
  'gobierno','presidente','presidencia','ministro','ministerio de seguridad','seguridad pública','seguridad publica',
  'inteligencia','fuerzas armadas','congreso','senado','cámara de diputados','camara de diputados','proyecto de ley',
  'terrorismo','atentado','frontera','crimen organizado','macrozona','homicidios','terremoto','tsunami','senapred',
  'alerta roja','incendio forestal','emergencia nacional','orden público','orden publico','subsecretaría del interior',
  'subsecretaria del interior'
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
  'campeonato','deportes','espectáculos','espectaculos'
];

const GENERIC_SUMMARY = [
  'comprehensive up-to-date news coverage',
  'aggregated from sources all over the world by google news',
  'google news',
  'latest news and headlines'
];

function norm(s='') {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function hasAny(s, arr) {
  const n = norm(s);
  return arr.some(x => n.includes(norm(x)));
}
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
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return m ? decodeXml(m[1]).trim() : '';
}
function sourceFrom(link, explicit='') {
  const e = clean(explicit);
  if (e) return e;
  try { return new URL(link).hostname.replace(/^www\./,''); } catch { return ''; }
}
function stripSourceSuffix(title, source='') {
  let t = clean(title);
  const s = clean(source);
  if (s) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    t = t.replace(new RegExp(`\\s*[-–—|]\\s*${escaped}\\s*$`,'i'),'').trim();
  }
  // Muchos titulares de Google News terminan en " - Medio".
  t = t.replace(/\s+[-–—|]\s+[^-–—|]{2,45}$/,'').trim();
  return t;
}
function similarity(a,b) {
  const A=new Set(norm(a).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  const B=new Set(norm(b).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>2));
  if (!A.size || !B.size) return 0;
  let inter=0; for (const w of A) if (B.has(w)) inter++;
  return inter/Math.max(A.size,B.size);
}
function usableSummary(title, raw, source='') {
  let s=clean(raw);
  const t=clean(title);
  if (!s || hasAny(s,GENERIC_SUMMARY) || s.length<55) return '';
  if (similarity(t,s)>0.78 || norm(s)===norm(t)) return '';
  if (norm(s).startsWith(norm(t))) s=s.slice(t.length).replace(/^\s*[-–—:|]\s*/,'').trim();
  if (!s || hasAny(s,GENERIC_SUMMARY) || similarity(t,s)>0.78 || s.length<55) return '';
  if (s.length>560) {
    s=s.slice(0,560);
    const cut=Math.max(s.lastIndexOf('. '),s.lastIndexOf('; '),s.lastIndexOf(', '));
    s=cut>240?s.slice(0,cut+1):s.replace(/\s+\S*$/,'')+'…';
  }
  return s;
}
function fallbackSummary(title, category, source='') {
  const t=stripSourceSuffix(title,source).replace(/[.]+$/,'').trim();
  if (!t) return 'Se identificó una publicación potencialmente relevante. Se recomienda revisar la fuente antes de su difusión.';
  if (category==='paso') return `Se informó una actualización relativa al Paso Fronterizo Los Libertadores: ${t}. Se recomienda verificar en la fuente la vigencia de la medida y las condiciones de operación antes de difundir.`;
  if (category==='autopistas') return `Se informó una novedad operacional en una ruta de interés para la Región de Valparaíso: ${t}. Se recomienda confirmar en la fuente su ubicación, sentido de tránsito y vigencia.`;
  if (category==='police') return `Se informó un hecho policial de interés en la Región de Valparaíso: ${t}. Se recomienda revisar la fuente para confirmar los antecedentes disponibles antes de difundir.`;
  if (category==='regional') return `En la Región de Valparaíso se informó que ${t.charAt(0).toLowerCase()+t.slice(1)}. Se recomienda revisar la publicación original para complementar los antecedentes antes de su difusión.`;
  return `A nivel nacional se informó que ${t.charAt(0).toLowerCase()+t.slice(1)}. Se recomienda revisar la fuente original para complementar los antecedentes antes de su difusión.`;
}
function classify(text,hint='national') {
  if (hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS)) return 'paso';
  if (hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS)) return 'autopistas';
  const regional=hasAny(text,REGION_TERMS);
  const police=hasAny(text,POLICE_TERMS);
  if (regional && police) return 'police';
  if (regional) return 'regional';
  if (hint==='police' && police && hasAny(text,CHILE_CONTEXT)) return 'police';
  return 'national';
}
function relevant(text,category) {
  if (hasAny(text,LOW_VALUE)) return false;
  if (category==='national') {
    const foreign=hasAny(text,FOREIGN_CONTEXT);
    const chile=hasAny(text,CHILE_CONTEXT);
    if (!chile) return false;
    if (foreign && !hasAny(text,['paso los libertadores','cristo redentor','frontera chile argentina'])) return false;
    return hasAny(text,NATIONAL_RELEVANCE) || hasAny(text,POLICE_TERMS);
  }
  if (category==='regional') return hasAny(text,REGION_TERMS) && hasAny(text,REGIONAL_RELEVANCE);
  if (category==='police') return hasAny(text,REGION_TERMS) && hasAny(text,POLICE_TERMS);
  if (category==='autopistas') return hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS);
  if (category==='paso') return hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS);
  return false;
}
function score(text,category,hint) {
  let s=0;
  if (category==='police') s+=8;
  if (category==='regional') s+=6;
  if (category==='national') s+=hasAny(text,NATIONAL_RELEVANCE)?6:3;
  if (category==='autopistas') s+=9;
  if (category==='paso') s+=9;
  if (hint===category) s+=1;
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
    const title=stripSourceSuffix(rawTitle,source).slice(0,220);
    const text=`${title} ${rawSummary} ${source}`;
    const category=classify(text,hint);
    if (!relevant(text,category)) return null;
    const sc=score(text,category,hint);
    const summary=usableSummary(title,rawSummary,source) || fallbackSummary(title,category,source);
    return {
      title, summary, url:link, source,
      published:published.toISOString(),
      category,
      relevance:sc>=8?'high':sc>=5?'medium':'low',
      included:sc>=5,
      provider
    };
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
    const r=await fetch(url,{
      headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/3.0)','accept':'application/rss+xml,application/xml,text/xml,*/*'},
      signal:ctrl.signal,redirect:'follow'
    });
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
    ['national',`Chile seguridad Gobierno Congreso PDI Carabineros crimen organizado inteligencia emergencia${dc}`],
    ['national',`Chile atentado terrorismo orden público Fuerzas Armadas SENAPRED frontera seguridad${dc}`],

    ['regional',`Valparaíso contingencia emergencia municipalidad protesta seguridad${dc}`],
    ['regional',`"Viña del Mar" contingencia emergencia municipalidad protesta seguridad${dc}`],
    ['regional',`Quilpué OR "Villa Alemana" OR Concón contingencia emergencia seguridad municipalidad${dc}`],
    ['regional',`Quillota OR Limache OR "La Calera" OR Quintero OR Puchuncaví contingencia emergencia seguridad${dc}`],
    ['regional',`"San Antonio" OR "Los Andes" OR "San Felipe" OR "La Ligua" contingencia emergencia seguridad${dc}`],
    ['regional',`"Rapa Nui" OR "Isla de Pascua" OR "Hanga Roa" emergencia seguridad contingencia${dc}`],

    ['police',`Valparaíso PDI OR Carabineros OR Fiscalía homicidio robo drogas detenido secuestro${dc}`],
    ['police',`"Viña del Mar" PDI OR Carabineros OR Fiscalía robo detenido homicidio drogas${dc}`],
    ['police',`Quilpué OR "Villa Alemana" OR Concón PDI Carabineros Fiscalía robo detenido drogas${dc}`],
    ['police',`site:pdi.cl Valparaíso${dc}`],
    ['police',`site:biobiochile.cl Valparaíso PDI Carabineros Fiscalía${dc}`],
    ['police',`site:cooperativa.cl Valparaíso PDI Carabineros Fiscalía${dc}`],
    ['regional',`site:puranoticia.pnt.cl Valparaíso${dc}`],
    ['regional',`site:g5noticias.cl Valparaíso${dc}`],
    ['regional',`site:observador.cl Valparaíso${dc}`],

    ['autopistas',`"Ruta 68" cierre accidente congestión desvío${dc}`],
    ['autopistas',`"Ruta 60 CH" OR "Autopista Los Andes" cierre accidente congestión${dc}`],
    ['autopistas',`"Ruta 5 Norte" OR "Autopista del Aconcagua" cierre accidente congestión${dc}`],
    ['autopistas',`"Ruta 62" OR "Camino Troncal" OR "Ruta 66" cierre accidente congestión${dc}`],

    ['paso',`"Paso Los Libertadores" abierto cerrado cierre habilitado nieve viento tránsito${dc}`],
    ['paso',`"Complejo Los Libertadores" OR "Cristo Redentor" abierto cerrado habilitado tránsito${dc}`]
  ];
}
function keyWords(title='') {
  const stop=new Set(['para','desde','sobre','entre','ante','tras','este','esta','estos','estas','chile','region',
    'valparaiso','noticia','hoy','dice','segun','informo','informan','nuevo','nueva']);
  return norm(title).replace(/[^a-z0-9ñ ]/g,' ').split(' ')
    .filter(w=>w.length>3&&!stop.has(w)).slice(0,12);
}
function sameEvent(a,b) {
  const A=new Set(keyWords(a.title)), B=new Set(keyWords(b.title));
  if (!A.size || !B.size) return false;
  let inter=0; for (const w of A) if (B.has(w)) inter++;
  return inter/Math.min(A.size,B.size)>=0.58;
}
function dedupe(items) {
  const out=[];
  for (const x of items) {
    const idx=out.findIndex(y=>y.category===x.category && sameEvent(x,y));
    if (idx<0) out.push(x);
    else {
      const old=out[idx];
      const rank=z=>(z.relevance==='high'?3:z.relevance==='medium'?2:1)+(z.summary&&!hasAny(z.summary,GENERIC_SUMMARY)?0.5:0);
      if (rank(x)>rank(old)) out[idx]=x;
    }
  }
  return out;
}

module.exports=async function handler(req,res) {
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
      if (['national','regional','police'].includes(hint)) jobs.push(fetchFeed(bing(q),hint,'Bing News'));
    }
    const batches=await Promise.all(jobs);
    const parsed=batches.flat();
    let news=parsed.filter(x=>{
      const d=new Date(x.published);
      return d>=start && d<=end;
    });
    news=dedupe(news).sort((a,b)=>{
      const r=x=>x.relevance==='high'?3:x.relevance==='medium'?2:1;
      return (r(b)-r(a)) || (new Date(b.published)-new Date(a.published));
    }).slice(0,120);

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      news,
      count:news.length,
      start:start.toISOString(),
      end:end.toISOString(),
      version:'3.0',
      diagnostics:{feedsConsulted:jobs.length,parsed:parsed.length,inPeriod:news.length}
    });
  } catch(e) {
    return res.status(500).json({
      error:'No fue posible consultar noticias',
      detail:String(e&&e.message?e.message:e)
    });
  }
};
