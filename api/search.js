// Vercel Serverless Function - sin dependencias externas.
// Devuelve noticias dentro del periodo exacto AM/PM solicitado por la interfaz.

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
  'arma','armas','drogas','narcotráfico','narcotrafico','microtráfico','microtrafico','detenido','detenidos',
  'detención','detencion','incautación','incautacion','allanamiento','crimen organizado','sicario','prisión preventiva',
  'prision preventiva','lavado de activos','tráfico de drogas','trafico de drogas','orden de detención','orden de detencion'
];

const REGIONAL_RELEVANCE = [
  'emergencia','incendio','inundación','inundacion','temporal','aluvión','aluvion','evacuación','evacuacion',
  'manifestación','manifestacion','protesta','marcha','huelga','paro','movilización','movilizacion','contaminación','contaminacion',
  'derrame','corte de agua','corte de energía','corte de energia','autoridad','delegado presidencial','seremi','gobernador',
  'alcalde','alcaldesa','corrupción','corrupcion','fraude','cohecho','malversación','malversacion','seguridad'
];

const AUTOPISTA_TERMS = [
  'ruta 68','rutas del pacífico','rutas del pacifico','ruta 60 ch','autopista los andes',
  'ruta 5 norte','autopista del aconcagua','ruta 62','camino troncal','ruta 66','carretera de la fruta'
];

const PASO_TERMS = [
  'paso los libertadores','paso fronterizo los libertadores','complejo los libertadores',
  'sistema integrado cristo redentor','cristo redentor','alta montaña','alta montana'
];

const NATIONAL_RELEVANCE = [
  'gobierno','presidente','ministro','ministerio de seguridad','seguridad pública','seguridad publica','inteligencia',
  'fuerzas armadas','congreso','senado','cámara de diputados','camara de diputados','proyecto de ley','terrorismo',
  'atentado','frontera','crimen organizado','macrozona','homicidios','terremoto','tsunami','senapred','alerta roja',
  'incendio forestal','emergencia nacional','orden público','orden publico'
];

const LOW_VALUE = [
  'cartelera','panorama','receta','horóscopo','horoscopo','festival gastronómico','festival gastronomico',
  'concierto','estreno de película','estreno de pelicula','televisión','television','farándula','farandula'
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
  return decodeXml(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function tag(block,name) {
  const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return m ? decodeXml(m[1]).trim() : '';
}
function sourceFrom(link, explicit='') {
  if (explicit) return clean(explicit);
  try { return new URL(link).hostname.replace(/^www\./,''); } catch { return ''; }
}
function score(text, category) {
  let s=0;
  if (category==='police' && hasAny(text,POLICE_TERMS)) s+=6;
  if (category==='regional' && hasAny(text,REGION_TERMS)) s+=4;
  if (category==='regional' && hasAny(text,REGIONAL_RELEVANCE)) s+=2;
  if (category==='national' && hasAny(text,NATIONAL_RELEVANCE)) s+=4;
  if (category==='autopistas') s+=6;
  if (category==='paso') s+=6;
  if (hasAny(text,['homicidio','secuestro','atentado','fallecido','muerto','heridos','alerta roja','evacuación','evacuacion'])) s+=1;
  if (hasAny(text,LOW_VALUE)) s-=5;
  return s;
}
function classify(text, hint='national') {
  if (hasAny(text,PASO_TERMS)) return 'paso';
  if (hasAny(text,AUTOPISTA_TERMS)) return 'autopistas';
  const regional=hasAny(text,REGION_TERMS);
  const police=hasAny(text,POLICE_TERMS);
  if (regional && police) return 'police';
  if (regional) return 'regional';
  if (hint==='police' && police) return 'police';
  return 'national';
}
function parseFeed(xml,hint,provider) {
  const blocks=xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block=>{
    const title=clean(tag(block,'title'));
    const summary=clean(tag(block,'description')) || clean(tag(block,'summary')) || clean(tag(block,'content'));
    let link=clean(tag(block,'link'));
    if (!link) {
      const m=block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (m) link=decodeXml(m[1]);
    }
    const rawDate=clean(tag(block,'pubDate')) || clean(tag(block,'published')) || clean(tag(block,'updated'));
    const published=new Date(rawDate);
    if (!title || Number.isNaN(published.getTime())) return null;
    const source=sourceFrom(link,tag(block,'source'));
    const text=`${title} ${summary} ${source}`;
    const category=classify(text,hint);
    const sc=score(text,category);
    if (sc<0) return null;
    return {
      title:title.slice(0,220),
      summary:(summary || `Información publicada por ${source || 'la fuente consultada'}.`).slice(0,1100),
      url:link,
      source,
      published:published.toISOString(),
      category,
      relevance:sc>=6?'high':sc>=3?'medium':'low',
      included:sc>=3,
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
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/1.0)','accept':'application/rss+xml,application/xml,text/xml,*/*'},signal:ctrl.signal,redirect:'follow'});
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
    ['national',`Chile seguridad PDI Carabineros homicidios crimen organizado Gobierno Congreso inteligencia emergencia${dc}`],
    ['national',`Chile atentado terrorismo frontera orden público incendio forestal SENAPRED Fuerzas Armadas${dc}`],
    ['regional',`Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR Concón OR Quillota OR "San Antonio" emergencia protesta autoridad seguridad${dc}`],
    ['regional',`Quintero OR Puchuncaví OR Limache OR "La Calera" OR "La Ligua" OR "Los Andes" OR "San Felipe" emergencia seguridad protesta${dc}`],
    ['regional',`"Rapa Nui" OR "Isla de Pascua" OR "Hanga Roa" emergencia seguridad aeropuerto tsunami temporal${dc}`],
    ['police',`Valparaíso PDI Carabineros Fiscalía homicidio robo drogas detenido secuestro${dc}`],
    ['regional',`site:observador.cl Valparaíso policial seguridad${dc}`],
    ['regional',`site:puranoticia.cl Valparaíso policial seguridad${dc}`],
    ['regional',`site:g5noticias.cl Valparaíso policial seguridad${dc}`],
    ['autopistas',`"Ruta 68" OR "Ruta 60 CH" OR "Ruta 5 Norte" OR "Ruta 62" OR "Ruta 66" accidente cierre tránsito congestión${dc}`],
    ['paso',`"Paso Los Libertadores" OR "Cristo Redentor" abierto cerrado nieve viento tránsito${dc}`]
  ];
}
function eventKey(x) {
  const stop=new Set(['para','desde','sobre','entre','ante','tras','este','esta','estos','estas','chile','region','valparaiso','noticia','hoy']);
  return norm(`${x.title} ${x.source}`).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>3&&!stop.has(w)).slice(0,12).join('|');
}
function dedupe(items) {
  const rank=x=>(x.relevance==='high'?3:x.relevance==='medium'?2:1)+(x.source?0.2:0);
  const m=new Map();
  for (const x of items) {
    const k=eventKey(x);
    if (!m.has(k) || rank(x)>rank(m.get(k))) m.set(k,x);
  }
  return [...m.values()];
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
      // Bing se usa como respaldo en consultas principales; evita sobrecargar la función.
      if (['national','police','regional'].includes(hint) && jobs.length<14) jobs.push(fetchFeed(bing(q),hint,'Bing News'));
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
    }).slice(0,100);
    res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=240');
    return res.status(200).json({
      news,
      count:news.length,
      start:start.toISOString(),
      end:end.toISOString(),
      diagnostics:{feedsConsulted:jobs.length,parsed:parsed.length,inPeriod:news.length}
    });
  } catch (e) {
    return res.status(500).json({error:'No fue posible consultar noticias',detail:String(e && e.message ? e.message : e)});
  }
};
