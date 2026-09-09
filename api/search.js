const REGION_WORDS = [
  "región de valparaíso","region de valparaiso","valparaíso","valparaiso",
  "viña del mar","vina del mar","quilpué","quilpue","villa alemana",
  "san antonio","concón","concon","quillota","los andes","san felipe",
  "limache","la calera","quintero","puchuncaví","puchuncavi","casablanca",
  "petorca","cabildo","la ligua","zapallar","papudo","nogales","hijuelas",
  "olmue","olmué","el quisco","el tabo","algarrobo","cartagena",
  "santo domingo","rapa nui","isla de pascua","hanga roa",
  "juan fernández","juan fernandez"
];

const POLICE_WORDS = [
  "pdi","policía de investigaciones","policia de investigaciones",
  "carabineros","fiscalía","fiscalia","gendarmería","gendarmeria",
  "homicidio","femicidio","parricidio","secuestro","robo","asalto",
  "balacera","arma","armas","drogas","narcotráfico","narcotrafico",
  "detenido","detenidos","detención","detencion","incautación","incautacion",
  "allanamiento","crimen organizado","sicario","prisión preventiva",
  "prision preventiva","microtráfico","microtrafico","lavado de activos"
];

const NATIONAL_WORDS = [
  "gobierno","presidente","ministro","congreso","senado","diputados",
  "seguridad nacional","seguridad interior","inteligencia",
  "sistema de inteligencia","fuerzas armadas","proyecto de ley",
  "terrorismo","atentado","frontera","macrozona","crimen organizado",
  "terremoto","tsunami","incendio forestal","inundacion","inundación",
  "aluvion","aluvión","temporal","tragedia","senapred","alerta roja",
  "evacuacion","evacuación","homicidio"
];

const REGIONAL_WORDS = [
  "alcalde","alcaldesa","gobernador","delegado presidencial","seremi",
  "autoridad regional","emergencia","desastre","incendio","inundacion",
  "inundación","temporal","tragedia","manifestacion","manifestación",
  "protesta","marcha","medioambiental","ambiental","contaminacion",
  "contaminación","estudiantes","universidad","sindicato","huelga",
  "trabajadores","pescadores","paro","movilizacion","movilización",
  "corrupcion","corrupción","cohecho","fraude","malversacion","malversación"
];

function norm(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function any(s, arr) {
  const z = norm(s);
  return arr.some(x => z.includes(norm(x)));
}

function decodeXml(s = "") {
  return String(s)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(Number(x)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function clean(s = "") {
  return decodeXml(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{\{?[\s\S]*?\}\}\}?/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i")
  );
  return m ? decodeXml(m[1]).trim() : "";
}

function classify(text, hint) {
  const regional = any(text, REGION_WORDS);
  const police = any(text, POLICE_WORDS);

  if (regional && police) return "police";
  if (regional) return "regional";
  if (hint === "police" && police) return "police";
  return "national";
}

function relevance(text, category) {
  let score = 0;

  if (category === "police" && any(text, POLICE_WORDS)) score += 4;
  if (category === "regional" && any(text, REGION_WORDS)) score += 3;
  if (category === "regional" && any(text, REGIONAL_WORDS)) score += 2;
  if (category === "national" && any(text, NATIONAL_WORDS)) score += 3;

  if (any(text, [
    "homicidio","fallecido","muerto","heridos","secuestro",
    "alerta roja","evacuacion","evacuación","atentado"
  ])) score++;

  return score;
}

function parseFeed(xml, hint, provider) {
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ||
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ||
    [];

  return blocks.map(block => {
    const title = clean(tag(block, "title"));

    const summary =
      clean(tag(block, "description")) ||
      clean(tag(block, "summary")) ||
      clean(tag(block, "content"));

    let link = clean(tag(block, "link"));

    if (!link) {
      const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (m) link = decodeXml(m[1]);
    }

    const rawDate =
      clean(tag(block, "pubDate")) ||
      clean(tag(block, "published")) ||
      clean(tag(block, "updated"));

    const date = new Date(rawDate);

    if (!title || Number.isNaN(date.getTime())) return null;

    const text = `${title} ${summary}`;
    const category = classify(text, hint);
    const score = relevance(text, category);

    let source = clean(tag(block, "source"));

    if (!source && link) {
      try {
        source = new URL(link).hostname.replace(/^www\./, "");
      } catch {}
    }

    return {
      title: title.slice(0, 220),
      summary: (summary || `Información publicada por ${source || "la fuente"}.`)
        .slice(0, 1000),
      url: link,
      published: date.toISOString(),
      source,
      category,
      relevance:
        score >= 5 ? "high" :
        score >= 3 ? "medium" : "low",
      included: score >= 3,
      provider
    };
  }).filter(Boolean);
}

function bing(q) {
  return "https://www.bing.com/news/search?q=" +
    encodeURIComponent(q) +
    '&setmkt=es-CL&qft=interval%3d%227%22&format=RSS';
}

function google(q) {
  return "https://news.google.com/rss/search?q=" +
    encodeURIComponent(q) +
    "&hl=es-419&gl=CL&ceid=CL:es-419";
}

async function getFeed(url, hint, provider) {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "application/rss+xml,application/xml,text/xml,*/*"
      },
      redirect: "follow"
    });

    if (!r.ok) return [];

    const xml = await r.text();
    return parseFeed(xml, hint, provider);
  } catch {
    return [];
  }
}

function queries() {
  return [
    [
      "national",
      'Chile (Gobierno OR seguridad OR inteligencia OR emergencia OR protesta OR homicidios OR PDI OR Carabineros OR Congreso)'
    ],
    [
      "national",
      'Chile (terrorismo OR atentado OR frontera OR "crimen organizado" OR "proyecto de ley" OR temporal OR incendio)'
    ],
    [
      "regional",
      '("Región de Valparaíso" OR Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR Concón OR Quillota OR "San Antonio" OR "Los Andes" OR "San Felipe") (emergencia OR autoridad OR protesta OR contaminación OR huelga OR corrupción OR temporal OR incendio OR transporte)'
    ],
    [
      "regional",
      '("Rapa Nui" OR "Isla de Pascua" OR "Hanga Roa") (emergencia OR temporal OR incendio OR accidente OR autoridad OR protesta OR seguridad OR aeropuerto OR tsunami OR evacuación)'
    ],
    [
      "police",
      '(Valparaíso OR "Viña del Mar" OR Quilpué OR "Villa Alemana" OR Concón OR Quillota OR Quintero OR "La Ligua" OR "San Antonio" OR "Los Andes" OR "San Felipe") (PDI OR Carabineros OR Fiscalía OR homicidio OR secuestro OR robo OR drogas OR detenido OR balacera OR microtráfico)'
    ],
    [
      "regional",
      '("Ruta 68" OR "Ruta 60 CH" OR "Ruta 5 Norte" OR "Ruta 62" OR "Ruta 66" OR "Autopista Los Andes" OR "Autopista del Aconcagua" OR "Carretera de la Fruta") (accidente OR cierre OR corte OR congestión OR desvío OR tránsito OR emergencia)'
    ],
    [
      "regional",
      '("Paso Los Libertadores" OR "Paso Fronterizo Los Libertadores" OR "Cristo Redentor") (abierto OR cerrado OR cierre OR habilitado OR suspendido OR nieve OR viento OR tránsito OR temporal)'
    ]
  ];
}

function eventKey(item) {
  let s = norm(item.title)
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = s
    .split(" ")
    .filter(w => w.length > 3)
    .slice(0, 12);

  return words.join(" ");
}

function dedupe(items) {
  const map = new Map();

  for (const item of items) {
    const key = eventKey(item);

    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const old = map.get(key);

    const score = x =>
      x.relevance === "high" ? 3 :
      x.relevance === "medium" ? 2 : 1;

    if (score(item) > score(old)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

export default async function handler(req, res) {
  try {
    const start = new Date(req.query.start);
    const end = new Date(req.query.end);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res.status(400).json({
        error: "Rango de fechas inválido"
      });
    }

    const tasks = [];

    for (const [hint, q] of queries()) {
      tasks.push(getFeed(bing(q), hint, "bing"));
      tasks.push(getFeed(google(q), hint, "google"));
    }

    const results = await Promise.all(tasks);

    let news = results
      .flat()
      .filter(item => {
        const d = new Date(item.published);
        return d >= start && d <= end;
      });

    news = dedupe(news);

    news.sort((a, b) => {
      const score = x =>
        x.relevance === "high" ? 3 :
        x.relevance === "medium" ? 2 : 1;

      if (score(b) !== score(a)) {
        return score(b) - score(a);
      }

      return new Date(b.published) - new Date(a.published);
    });

    news = news.slice(0, 80);

    res.setHeader(
      "Cache-Control",
      "s-maxage=180, stale-while-revalidate=300"
    );

    return res.status(200).json({
      news,
      count: news.length,
      start: start.toISOString(),
      end: end.toISOString()
    });

  } catch (e) {
    return res.status(500).json({
      error: "No fue posible consultar noticias",
      detail: String(e?.message || e)
    });
  }
      }
