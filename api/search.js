const PLACE_WORDS=["valparaíso","valparaiso","viña del mar","vina del mar","quilpué","quilpue","villa alemana","san antonio","concón","concon","quillota","los andes","san felipe","limache","la calera","quintero","puchuncaví","puchuncavi","casablanca"];
const POLICE_WORDS=["homicidio","secuestro","robo","asalto","balacera","arma de fuego","drogas","narcotráfico","narcotrafico","detenido","detención","detencion","pdi","carabineros","fiscalía","fiscalia","prisión preventiva","prision preventiva","crimen organizado","allanamiento","incautación","incautacion","femicidio","parricidio"];
const NATIONAL_WORDS=["gobierno","presidente","congreso","senado","diputados","ministro","política","politica","manifestación","manifestacion","protesta","paro","emergencia","senapred","sistema frontal","temporal","incendio","seguridad","crisis","alerta roja","huelga"];
function norm(s=""){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function any(s,a){const n=norm(s);return a.some(w=>n.includes(norm(w)))}
function decodeXml(s=""){return s.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")}
function stripHtml(s=""){return decodeXml(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function tag(block,name){const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));return m?decodeXml(m[1]).trim():""}
function parseRss(xml,hint){
  const blocks=xml.match(/<item[\s\S]*?<\/item>/gi)||[];
  return blocks.map(b=>{
    const title=stripHtml(tag(b,"title"));
    const description=stripHtml(tag(b,"description"));
    const link=stripHtml(tag(b,"link"));
    const pubDate=stripHtml(tag(b,"pubDate"));
    const source=stripHtml(tag(b,"source"));
    if(!title||!pubDate)return null;
    const text=title+" "+description;
    const regional=any(text,PLACE_WORDS), police=any(text,POLICE_WORDS);
    let category=hint;
    if(regional&&police)category="police";
    else if(regional)category="regional";
    else if(hint==="police"&&!regional)category="national";
    let score=0;
    if(category==="police"&&police)score+=3;
    if(category==="regional"&&regional)score+=2;
    if(category==="national"&&(any(text,NATIONAL_WORDS)||police))score+=2;
    if(any(text,["muerto","fallecido","heridos","prisión preventiva","prision preventiva","alerta roja","evacuación","evacuacion"]))score++;
    return {title,summary:(description||`Información publicada por ${source||"la fuente"}.`).slice(0,900),url:link,published:new Date(pubDate).toISOString(),source,category,relevance:score>=4?"high":score>=2?"medium":"low",included:score>=2};
  }).filter(Boolean);
}
function bing(q){return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&setmkt=es-CL&qft=interval%3d%227%22&format=RSS`}
export default async function handler(req,res){
  try{
    const start=new Date(req.query.start),end=new Date(req.query.end);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return res.status(400).json({error:"Rango inválido"});
    const defs=[
      ["national",'Chile (Gobierno OR política OR policial OR emergencia OR protesta OR seguridad OR incendio OR temporal)'],
      ["regional",'("Región de Valparaíso" OR Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR "San Antonio" OR Concón OR Quillota OR "Los Andes" OR "San Felipe") (autoridad OR emergencia OR protesta OR salud OR transporte OR contingencia)'],
      ["police",'(Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR "San Antonio" OR Concón OR Quillota OR "Los Andes" OR "San Felipe") (PDI OR Carabineros OR Fiscalía OR homicidio OR secuestro OR robo OR asalto OR drogas OR detenido OR balacera OR "prisión preventiva")']
    ];
    let all=[];
    for(const [hint,q] of defs){
      try{
        const r=await fetch(bing(q),{headers:{"user-agent":"Mozilla/5.0"}});
        if(!r.ok)continue;
        all.push(...parseRss(await r.text(),hint));
      }catch{}
    }
    const seen=new Set(),news=[];
    for(const n of all){
      const t=new Date(n.published);
      if(t<start||t>end)continue;
      const key=norm(n.title).replace(/[^a-z0-9]/g,"").slice(0,140);
      if(seen.has(key))continue;
      seen.add(key);news.push(n);
    }
    news.sort((a,b)=>new Date(a.published)-new Date(b.published));
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({news,count:news.length,start:start.toISOString(),end:end.toISOString()});
  }catch(e){return res.status(500).json({error:"No fue posible consultar noticias"});}
}