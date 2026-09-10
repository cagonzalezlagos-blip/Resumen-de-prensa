// Resumen de Prensa V8.3 - Vercel Serverless Function
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

function isGoogleNewsUrl(url='') {
  return /news\.google\.com/i.test(String(url));
}
function chileSourceName(source='') {
  return hasAny(source,[
    'biobio','cnn chile','cooperativa','soy chile','soyvalparaiso','puranoticia','g5 noticias','g5noticias',
    'observador','ucv','radio valparaiso','radio valparaíso','radio carnaval','prensa marga marga',
    'municipalidad de','senado','camara de diputados','cámara de diputados','pdi','carabineros','senapred','conaf'
  ]);
}
function regionalContext(text='', source='') {
  const n=norm(text);
  if (n.includes('san antonio') && !hasAny(text,['valparaiso','valparaíso','chile','region de valparaiso','región de valparaíso']) && !chileSourceName(source)) return false;
  if (n.includes('la calera') && !hasAny(text,['valparaiso','valparaíso','chile','quillota']) && !chileSourceName(source)) return false;
  if (hasAny(text,['sinaloa','mexico','méxico','texas','california','argentina','mendoza','peru','perú','colombia','ecuador']) && !hasAny(text,['paso los libertadores','cristo redentor','frontera chile argentina'])) return false;
  return hasAny(text,REGION_TERMS);
}
function lowImpactSeismic(text='') {
  const n=norm(text);
  if (!/(sismo|terremoto|temblor)/.test(n)) return false;
  const m=n.match(/(?:mag(?:nitud)?\.?\s*|magnitud\s*)(\d+(?:[.,]\d+)?)/);
  if (!m) return false;
  const mag=parseFloat(m[1].replace(',','.'));
  if (Number.isNaN(mag) || mag>=5.5) return false;
  return !hasAny(text,['daños','danos','heridos','fallecidos','evacuación','evacuacion','tsunami','alerta','senapred']);
}
function sourceQuality(source='',url='') {
  let q=0;
  if (chileSourceName(source)) q+=4;
  if (!isGoogleNewsUrl(url)) q+=2;
  if (hasAny(source,['biobio'])) q+=8;
  else if (hasAny(source,['cnn chile','cooperativa','soy chile','puranoticia','ucv radio','senado','pdi','carabineros','senapred','conaf'])) q+=3;
  if (hasAny(source,['volcano discovery','la república ec','la republica ec','telemundo san antonio','diario uno','diariodecuyo'])) q-=2;
  return q;
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


function ordinaryTrafficAccident(text='') {
  const n=norm(text);
  const accident=hasAny(n,['colisión','colision','choque','volcamiento','accidente de tránsito','accidente de transito','microbús','microbus']);
  const crime=hasAny(n,['detenido','detenidos','asalto','balacera','homicidio','secuestro','arma de fuego','drogas','narcotráfico','narcotrafico','fiscalía','fiscalia','pdi']);
  return accident && !crime;
}
function policeOperationalContext(text='') {
  return strongPolice(text) || hasAny(text,[
    'fiscalización','fiscalizacion','control carretero','operativo','procedimiento policial',
    'detenido','detenidos','incautación','incautacion','allanamiento'
  ]);
}
function classify(text,hint='national',source='') {
  if (hasAny(text,PASO_TERMS) && hasAny(text,PASO_OPERATION_TERMS)) return 'paso';
  if (hasAny(text,AUTOPISTA_TERMS) && hasAny(text,ROAD_OPERATION_TERMS)) return 'autopistas';
  const regional=regionalContext(text,source);
  if (regional && ordinaryTrafficAccident(text)) return 'regional';
  const police=policeOperationalContext(text);
  if (regional && police) return 'police';
  if (regional) return 'regional';
  return 'national';
}
function relevant(text,category,source='') {
  if (hasAny(text,LOW_VALUE) || lowImpactSeismic(text)) return false;
  if (category==='national') {
    const foreign=hasAny(text,FOREIGN_CONTEXT);
    const chile=hasAny(text,CHILE_CONTEXT);
    if (!chile) return false;
    if (foreign && !hasAny(text,['paso los libertadores','cristo redentor','frontera chile argentina'])) return false;
    return hasAny(text,[
      'seguridad pública','seguridad publica','crimen organizado','terrorismo','atentado','inteligencia',
      'orden público','orden publico','fuerzas armadas','estado de excepción','estado de excepcion',
      'frontera','homicidio','homicidios','secuestro','pdi','carabineros','fiscalía','fiscalia',
      'senapred','alerta roja','incendio forestal','terremoto','tsunami'
    ]) || strongPolice(text);
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
    const category=classify(text,hint,source);
    if (!relevant(text,category,source)) return null;
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
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/8.3)','accept':'application/rss+xml,application/xml,text/xml,*/*'},signal:ctrl.signal,redirect:'follow'});
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

function stripTracking(url='') {
  try {
    const u=new URL(url);
    const drop=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','oc'];
    for (const k of drop) u.searchParams.delete(k);
    u.hash='';
    return u.toString().replace(/\?$/,'');
  } catch { return url; }
}
function jsonLdArticleBody(html='') {
  const scripts=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for (const s of scripts) {
    const raw=s.replace(/^<script[^>]*>/i,'').replace(/<\/script>$/i,'').trim();
    try {
      const data=JSON.parse(raw);
      const stack=Array.isArray(data)?[...data]:[data];
      while(stack.length){
        const x=stack.shift();
        if(!x||typeof x!=='object') continue;
        if(typeof x.articleBody==='string' && x.articleBody.length>180) return clean(x.articleBody);
        if(x['@graph']&&Array.isArray(x['@graph'])) stack.push(...x['@graph']);
      }
    } catch {}
  }
  return '';
}
function htmlParagraphs(html='') {
  const cleaned=String(html)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
  const ps=[...cleaned.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map(m=>editorialClean(m[1]))
    .filter(p=>p.length>=70 && p.length<=1400)
    .filter(p=>!hasAny(p,['suscríbete','suscribete','newsletter','publicidad','síguenos','siguenos','cookies','copyright']));
  return ps.join(' ');
}

function editorialClean(text='') {
  let s=clean(text)
    .replace(/\bKeywords?\s*:\s*[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bTags?\s*:\s*[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bTemas?\s*:\s*[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bLee también\b[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bTambién puedes leer\b[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bTe puede interesar\b[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bRelacionado(?:s)?\b\s*:?\s*[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bSíguenos en\b[^.]{0,300}(?:\.|$)/gi,' ')
    .replace(/\bSuscríbete\b[^.]{0,300}(?:\.|$)/gi,' ')
    .replace(/\bNewsletter\b[^.]{0,300}(?:\.|$)/gi,' ')
    .replace(/\bPublicidad\b/gi,' ')
    .replace(/\bCoach Ontológico\b[^.]{0,600}(?:\.|$)/gi,' ')
    .replace(/\bSomos un medio regional e independiente\b[^.]{0,500}(?:\.|$)/gi,' ')
    .replace(/\bTe resumimos las noticias\b[^.]{0,700}(?:\.|$)/gi,' ')
    .replace(/\bEntregamos en horario AM\b[^.]{0,1200}(?:\.|$)/gi,' ')
    .replace(/\bEntregamos en horario PM\b[^.]{0,1200}(?:\.|$)/gi,' ')
    .replace(/\ba todos nuestros suscriptores\b[^.]{0,1200}(?:\.|$)/gi,' ')
    .replace(/[•●▪■◆►▶]+/g,' ')
    .replace(/[|]{2,}/g,' ')
    .replace(/\s+([,.;:!?])/g,'$1')
    .replace(/([,.;:!?]){2,}/g,'$1')
    .replace(/\s{2,}/g,' ')
    .trim();

  return s;
}
function editorialSentence(s='') {
  const n=norm(s);
  if(!s || s.length<45) return false;
  if(hasAny(n,[
    'keywords:','keyword:','tags:','temas:','publicidad','suscribete','suscríbete',
    'newsletter','cookies','copyright','coach ontologico','coach ontológico',
    'somos un medio regional','te resumimos las noticias','lee tambien','lee también',
    'tambien puedes leer','también puedes leer','te puede interesar'
  ])) return false;

  // Evita referencias incrustadas a otra noticia con fecha/hora.
  if(/\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+\w+\s*,?\s*\d{4}\s*\|\s*\d{1,2}:\d{2}/i.test(s)) return false;
  return true;
}

function normalizeSentenceCase(s='') {
  s=clean(s);
  if(!s) return '';
  // Conserva siglas frecuentes
  s=s.replace(/\bpdi\b/gi,'PDI')
     .replace(/\bconaf\b/gi,'CONAF')
     .replace(/\bsenapred\b/gi,'Senapred')
     .replace(/\bsenda\b/gi,'SENDA')
     .replace(/\bsamu\b/gi,'SAMU')
     .replace(/\bfiscalia\b/gi,'Fiscalía')
     .replace(/\bcarabineros\b/gi,'Carabineros');

  s=s.charAt(0).toUpperCase()+s.slice(1);
  if(!/[.!?]$/.test(s)) s+='.';
  return s;
}

function splitIntoParagraphs(sentences=[]){
  if(sentences.length<=2) return sentences.join(' ');
  const first=sentences.slice(0,2).join(' ');
  const second=sentences.slice(2).join(' ');
  return second ? `${first}\n\n${second}` : first;
}

function summaryLooksEditoriallyBad(text=''){
  const n=norm(text);
  if(!n) return true;
  if(hasAny(n,[
    'coach ontologico','coach ontológico','suscriptores de talca','pauta noticiosa',
    'somos un medio regional','te resumimos las noticias','keywords:','tags:',
    'lee tambien','lee también','tambien puedes leer','también puedes leer',
    'te puede interesar','newsletter','publicidad'
  ])) return true;
  return false;
}

function completeTitleFromUrl(title='',url=''){
  let t=clean(title);
  if(!url) return t;
  try{
    const u=new URL(url);
    const slug=u.pathname.split('/').filter(Boolean).pop()||'';
    if(!slug) return t;
    const words=slug.replace(/\.shtml?$/i,'').replace(/[-_]+/g,' ').trim();
    if(words.length<=t.length+10) return t;

    // Solo completa cuando el título parece claramente cortado.
    const truncated=/[:;,–—-]\s*(?:de|del|la|el|un|una|y|o)?\s*$/i.test(t) || t.length<42;
    if(!truncated) return t;

    let restored=words.charAt(0).toUpperCase()+words.slice(1);
    restored=restored
      .replace(/\bpdi\b/gi,'PDI')
      .replace(/\bconaf\b/gi,'CONAF')
      .replace(/\bsenapred\b/gi,'Senapred')
      .replace(/\bsenda\b/gi,'SENDA');
    return restored;
  }catch{
    return t;
  }
}

function formalizeSummary(text='') {
  let s=editorialClean(text)
    .replace(/\s+([”"'])/g,'$1')
    .replace(/([“"'])\s+/g,'$1')
    .replace(/\s*-\s*-\s*/g,' - ')
    .trim();

  if(s && !/[.!?]$/.test(s)) s+='.';
  return s;
}

function sentenceSplit(text='') {
  return editorialClean(text)
    .replace(/\s+/g,' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9¿¡“"'])/)
    .map(s=>s.trim())
    .filter(s=>s.length>=45 && s.length<=420)
    .filter(editorialSentence);
}
function extractiveSummary(articleText='',title='',category='national') {
  const sentences=sentenceSplit(articleText);
  if(!sentences.length) return '';

  const titleWords=new Set(
    norm(title).replace(/[^a-z0-9ñ ]/g,' ').split(' ').filter(w=>w.length>4)
  );

  const categoryTerms={
    national:NATIONAL_RELEVANCE,
    regional:REGIONAL_RELEVANCE,
    police:POLICE_STRONG_TERMS,
    autopistas:[...AUTOPISTA_TERMS,...ROAD_OPERATION_TERMS],
    paso:[...PASO_TERMS,...PASO_OPERATION_TERMS]
  }[category]||[];

  const candidates=sentences.map((s,i)=>{
    const ns=norm(s);
    let sc=0;

    // Qué ocurrió
    for(const w of titleWords) if(ns.includes(w)) sc+=1.45;
    if(hasAny(s,categoryTerms)) sc+=2.8;

    // Quiénes
    if(hasAny(s,['PDI','Carabineros','Fiscalía','Gobierno','Senado','Senapred','CONAF','SENDA',
                 'municipalidad','alcalde','alcaldesa','ministro','delegado presidencial',
                 'Ministerio Público','Ministerio de Seguridad Pública'])) sc+=1.5;

    // Dónde
    if(hasAny(s,REGION_TERMS) || hasAny(s,['Chile','Santiago','Región de Valparaíso','region de valparaiso'])) sc+=1.2;

    // Cuándo
    if(/\b(hoy|ayer|esta mañana|esta tarde|esta noche|jueves|viernes|sábado|sabado|domingo|lunes|martes|miércoles|miercoles|\d{1,2}:\d{2}|\d{1,2}\s+de\s+\w+)\b/i.test(s)) sc+=0.8;

    // Cómo / causa / consecuencia
    if(hasAny(s,['debido a','a raíz de','a raiz de','como consecuencia','producto de','tras',
                 'luego de','mediante','resultó','resulto','dejó','dejo','detenido','detenidos',
                 'incautó','incauto','lesionado','lesionados','fallecido','fallecidos',
                 'permitió','permitio','terminó','termino','culminó','culmino'])) sc+=1.4;

    // Datos concretos
    if(/\b\d{1,4}\b/.test(s)) sc+=0.7;

    // Orden narrativo
    if(i<5) sc+=1.4;

    return {s:normalizeSentenceCase(s),i,sc};
  })
  .filter(x=>editorialSentence(x.s))
  .sort((a,b)=>b.sc-a.sc);

  const chosen=[];
  for(const x of candidates){
    if(chosen.some(y=>similarity(y.s,x.s)>0.68)) continue;
    chosen.push(x);
    if(chosen.length>=4) break;
  }

  if(!chosen.length) return '';

  // Orden original del artículo para lectura natural.
  chosen.sort((a,b)=>a.i-b.i);

  // Evita que la última oración sea un subtítulo pegado o arranque incompleto.
  const selected=chosen.map(x=>x.s)
    .filter(s=>!summaryLooksEditoriallyBad(s))
    .filter(s=>!/^(Llaman a|Mesas de trabajo|La otra causa|Más información|Revisa también|En desarrollo)\b/i.test(s));

  if(!selected.length) return '';

  let out=splitIntoParagraphs(selected);

  // Límite de extensión, conservando frases completas.
  if(out.length>1050){
    const flat=out.replace(/\n\n/g,' ');
    const parts=sentenceSplit(flat);
    let acc='';
    for(const p of parts){
      const candidate=(acc?acc+' ':'')+p;
      if(candidate.length>980 && acc.length>420) break;
      acc=candidate;
    }
    out=acc;
  }

  out=formalizeSummary(out);

  if(out.length<170 || similarity(out,title)>0.72 || summaryLooksEditoriallyBad(out)) return '';
  return out;
}

function compactDisplayUrl(url='') {
  try {
    const u=new URL(url);
    let path=u.pathname.replace(/\/+$/,'');
    if(path.length>72){
      const parts=path.split('/').filter(Boolean);
      path='/'+parts.slice(-2).join('/');
    }
    return `${u.hostname.replace(/^www\./,'')}${path}`;
  } catch { return ''; }
}
function reportSourceName(source='',url='') {
  if(hasAny(source,['biobio']) || /biobiochile\.cl/i.test(url)) return 'BioBioChile';
  if(hasAny(source,['cnn chile']) || /cnnchile\.com/i.test(url)) return 'CNN Chile';
  if(hasAny(source,['cooperativa']) || /cooperativa\.cl/i.test(url)) return 'Cooperativa';
  if(hasAny(source,['puranoticia']) || /puranoticia/i.test(url)) return 'Puranoticia';
  if(hasAny(source,['soy chile']) || /soychile\.cl/i.test(url)) return 'SoyChile';
  if(hasAny(source,['ucv']) || /ucvradio\.cl/i.test(url)) return 'UCV Radio';
  return clean(source||'Fuente');
}

function canonicalLink(html) {
  const m=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
          html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return m?decodeXml(m[1]).trim():'';
}
function isDirectSourceUrl(url='') {
  try { return !/news\.google\.com|bing\.com\/news/i.test(new URL(url).hostname+new URL(url).pathname); } catch { return false; }
}

async function resolveDirectByTitle(item) {
  const title=clean(item.title||'');
  if(!title) return '';
  let domainHint='';
  const s=norm(item.source||'');
  if(s.includes('biobio')) domainHint=' site:biobiochile.cl';
  else if(s.includes('cnn chile')) domainHint=' site:cnnchile.com';
  else if(s.includes('cooperativa')) domainHint=' site:cooperativa.cl';
  else if(s.includes('puranoticia')) domainHint=' site:puranoticia.cl OR site:puranoticia.pnt.cl';
  else if(s.includes('soy chile')) domainHint=' site:soychile.cl';
  else if(s.includes('ucv')) domainHint=' site:ucvradio.cl';

  const q=`"${title.replace(/"/g,'')}"${domainHint}`;
  const url=bing(q);
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),5000);
  try{
    const r=await fetch(url,{
      headers:{'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/8.3)'},
      signal:ctrl.signal,redirect:'follow'
    });
    if(!r.ok) return '';
    const xml=await r.text();
    const blocks=xml.match(/<item[\s\S]*?<\/item>/gi)||[];
    for(const b of blocks.slice(0,8)){
      const t=stripSourceSuffix(clean(tag(b,'title')),clean(tag(b,'source')));
      let link=clean(tag(b,'link'));
      if(!link){
        const m=b.match(/<link[^>]+href=["']([^"']+)["']/i);
        if(m) link=decodeXml(m[1]);
      }
      if(!link || isGoogleNewsUrl(link)) continue;
      if(similarity(title,t)>=0.68){
        return stripTracking(link);
      }
    }
    return '';
  }catch{return '';}
  finally{clearTimeout(timer);}
}

async function enrichItem(item) {
  if (!item.url) return item;

  let workingUrl=item.url;
  if (isGoogleNewsUrl(workingUrl)) {
    const resolved=await resolveDirectByTitle(item);
    if (resolved) workingUrl=resolved;
  }

  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),6500);
  try {
    const r=await fetch(workingUrl,{
      headers:{
        'user-agent':'Mozilla/5.0 (compatible; ResumenPrensa/8.3)',
        'accept':'text/html,application/xhtml+xml'
      },
      signal:ctrl.signal,
      redirect:'follow'
    });
    if (!r.ok) return item;

    const html=await r.text();
    const finalUrl=r.url||workingUrl;
    const canonical=stripTracking(canonicalLink(html)||finalUrl);
    const ogTitle=metaContent(html,'property','og:title') || metaContent(html,'name','twitter:title');
    const ogDesc=metaContent(html,'property','og:description') || metaContent(html,'name','description') || metaContent(html,'name','twitter:description');
    const direct=isDirectSourceUrl(canonical);

    let source=item.source;
    if (direct) {
      try { source=new URL(canonical).hostname.replace(/^www\./,''); } catch {}
    }

    const candidateTitle=completeTitleFromUrl(direct && ogTitle ? stripSourceSuffix(ogTitle,source) : item.title, canonical);
    const context=`${candidateTitle} ${ogDesc||''} ${source||''}`;
    const category=classify(context,item.hint,source);

    // El resumen se construye desde el cuerpo real cuando es posible.
    const articleBody=jsonLdArticleBody(html) || htmlParagraphs(html);
    let articleSummary='';
    if (direct && articleBody && articleBody.length>180) {
      articleSummary=extractiveSummary(articleBody,candidateTitle,category);
    }

    const metaSummary=usableSummary(candidateTitle,ogDesc,source);
    const feedSummary=usableSummary(candidateTitle,item.summary,source);
    const summary=formalizeSummary(articleSummary || metaSummary || feedSummary || '');

    return {
      ...item,
      title:candidateTitle||item.title,
      summary,
      summaryFromArticle:!!articleSummary,
      summaryMethod:articleSummary?'article-body':(metaSummary?'meta-description':(feedSummary?'rss':'none')),
      url:direct?canonical:stripTracking(workingUrl),
      reportUrl:direct?canonical:'',
      source:reportSourceName(source,canonical),
      direct,
      articleChars:articleBody.length
    };
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

    ['national',`site:biobiochile.cl Chile (seguridad OR Gobierno OR Senado OR PDI OR Carabineros OR emergencia)${dc}`],
    ['regional',`site:biobiochile.cl Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR Concón${dc}`],
    ['police',`site:biobiochile.cl Valparaíso (PDI OR Carabineros OR Fiscalía OR homicidio OR robo OR drogas)${dc}`],

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

function eventSignature(title=''){
  const n=norm(title);
  const nums=(n.match(/\d+(?:[.,]\d+)?/g)||[]).slice(0,4).join('|');
  const core=[
    hasAny(n,['homicidio','homicidios'])?'homicidios':'',
    hasAny(n,['crimen organizado'])?'crimen-organizado':'',
    hasAny(n,['secreto bancario'])?'secreto-bancario':'',
    hasAny(n,['paso los libertadores','cristo redentor'])?'paso-libertadores':'',
    hasAny(n,['senda','micreros','conductores'])?'senda-conductores':'',
    hasAny(n,['ketamina'])?'ketamina':''
  ].filter(Boolean).join('|');
  return `${core}|${nums}`;
}
function sameEvent(a,b) {
  const na=norm(a.title), nb=norm(b.title);
  const sigA=eventSignature(a.title), sigB=eventSignature(b.title);
  if(sigA && sigB && sigA===sigB && sigA.replace(/\|/g,'').length>4) return true;

  // Paso fronterizo: un solo hecho operacional por cierre/apertura.
  if (a.category==='paso' && b.category==='paso') {
    const closeA=/(cierre|cerrar|cerrado|cierran|suspende)/.test(na);
    const closeB=/(cierre|cerrar|cerrado|cierran|suspende)/.test(nb);
    const openA=/(abre|abierto|habilitado|reabre)/.test(na);
    const openB=/(abre|abierto|habilitado|reabre)/.test(nb);
    if ((closeA&&closeB)||(openA&&openB)) return true;
  }

  // Casos conocidos con entidades coincidentes.
  if (hasAny(na,['longton']) && hasAny(nb,['longton']) && hasAny(na,['squella']) && hasAny(nb,['squella'])) return true;

  const A=new Set(keyWords(a.title)), B=new Set(keyWords(b.title));
  if (!A.size || !B.size) return false;

  let inter=0;
  for (const w of A) if (B.has(w)) inter++;
  const minRatio=inter/Math.min(A.size,B.size);
  const union=new Set([...A,...B]).size;
  const jaccard=union ? inter/union : 0;

  // Refuerzo para cifras + tema coincidente: evita dos notas del mismo balance de homicidios.
  const numsA=(na.match(/\d+(?:[.,]\d+)?/g)||[]);
  const numsB=(nb.match(/\d+(?:[.,]\d+)?/g)||[]);
  const sameNumber=numsA.some(n=>numsB.includes(n));
  const sameCore=hasAny(na,['homicidio','homicidios','crimen organizado']) &&
                 hasAny(nb,['homicidio','homicidios','crimen organizado']);
  if(sameNumber && sameCore && inter>=2) return true;

  return (inter>=4 && minRatio>=0.40) || minRatio>=0.58 || jaccard>=0.48;
}
function quality(item) {
  let q=0;
  if (item.summaryFromArticle) q+=10;
  else if (item.summary) q+=4;
  if (item.direct||isDirectSourceUrl(item.url)) q+=4;
  if (hasAny(item.source,['BioBioChile','biobio'])) q+=16;
  if (item.provider==='Bing News') q+=1;
  if (item.title && item.title.length>=45 && item.title.length<=220) q+=2;
  q+=sourceQuality(item.source,item.url);

  const content=`${item.title||''} ${item.summary||''}`;
  if(hasAny(content,['keywords:','coach ontológico','coach ontologico','somos un medio regional','newsletter','publicidad','suscriptores de talca','pauta noticiosa'])) q-=30;
  if(item.summary && item.summary.length>=180 && item.summary.length<=950) q+=2;
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
  let t=clean(title).replace(/^\[VIDEO\]\s*/i,'').replace(/[.]+$/,'').trim();
  if (!t) return '';
  if (/^PDI\s+/i.test(t)) t=t.replace(/^PDI\s+/i,'La Policía de Investigaciones ');
  else if (/^SIP de Carabineros/i.test(t)) t=t.replace(/^SIP de Carabineros/i,'Personal de la SIP de Carabineros');
  else if (/^Senado\s+/i.test(t)) t='El Senado '+t.slice(7);
  else if (/^Gobierno\s+/i.test(t)) t='El Gobierno '+t.slice(9);

  t=t.replace(/\bdesarticula\b/i,'desarticuló')
     .replace(/\bdetiene\b/i,'detuvo')
     .replace(/\baprueba\b/i,'aprobó')
     .replace(/\bdespacha\b/i,'despachó')
     .replace(/\banuncian\b/i,'se anunció')
     .replace(/\bconfirmaron\b/i,'se confirmó');

  t=t.charAt(0).toUpperCase()+t.slice(1);
  if (!/[.!?]$/.test(t)) t+='.';
  return t;
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
      const category=classify(text,x.hint,x.source);
      if (!relevant(text,category,x.source)) return null;
      const direct=!!x.direct||isDirectSourceUrl(x.url);
      const sc=score(text,category,x.hint,!!x.summary,direct);
      const title=stripSourceSuffix(x.title,x.source).trim();
      const badTitle=suspiciousTitle(title);
      const summary=x.summary||'';
      return {
        title,
        summary,
        url:x.url,
        reportUrl:x.reportUrl||'',
        displayUrl:compactDisplayUrl(x.reportUrl||x.url||''),
        source:x.source,
        published:x.published,
        category,
        relevance:sc>=10?'high':sc>=7?'medium':'low',
        included:false,
        scoreValue:sc,
        summaryVerified:!!x.summary,
        summaryFromArticle:!!x.summaryFromArticle,
        titleVerified:!badTitle,
        provider:x.provider
      };
    }).filter(Boolean);

    news=news.sort((a,b)=>{
      const r=x=>x.relevance==='high'?3:x.relevance==='medium'?2:1;
      return (r(b)-r(a))||(b.scoreValue-a.scoreValue)||(sourceQuality(b.source,b.url)-sourceQuality(a.source,a.url))||(new Date(b.published)-new Date(a.published));
    }).slice(0,120);

    // Preselección equilibrada: prioriza relevancia, evita saturar el informe
    // y deja el resto disponible para revisión manual.
    const quotas={national:4,regional:4,police:5,autopistas:2,paso:1};
    const used={national:0,regional:0,police:0,autopistas:0,paso:0};
    news=news.map(x=>{
      const truncatedTitle=/[:;,\-–—]\s*(?:de|del|la|el|un|una|y|o)?\s*$/i.test((x.title||'').trim()) || (x.title||'').length<28;
      const dirtySummary=summaryLooksEditoriallyBad(x.summary||'');
      const eligible=x.titleVerified && !truncatedTitle && !dirtySummary && x.relevance!=='low' && x.scoreValue>=7 && !!x.reportUrl && (!!x.summaryFromArticle || (x.summaryVerified && x.summary && x.summary.length>=150));
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
      news,count:news.length,start:start.toISOString(),end:end.toISOString(),version:'8.3',
      diagnostics:{feedsConsulted:jobs.length,raw:batches.flat().length,inPeriod:parsed.length,enriched:enriched.length,final:news.length}
    });
  } catch(e) {
    return res.status(500).json({error:'No fue posible consultar noticias',detail:String(e&&e.message?e.message:e)});
  }
};
