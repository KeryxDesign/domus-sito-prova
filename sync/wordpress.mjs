// Legge articoli e domande frequenti da un WordPress usato solo come area di scrittura (headless).
// Si legge l'API REST pubblica: solo contenuti pubblicati, nessuna chiave. Le bozze di Luana restano in WordPress.
//   WORDPRESS_API  indirizzo base dell'API, per esempio
//                  https://contenuti.esempio.it/wp-json/wp/v2           (WordPress su hosting)
//                  https://public-api.wordpress.com/wp/v2/sites/xxx.wordpress.com   (sito WordPress.com)
// Convenzioni in WordPress:
//   articoli  = Articoli pubblicati; la prima categoria diventa l'etichetta (Vendere, Comprare); immagine in evidenza = foto.
//   domande   = la Pagina con slug "domande-e-risposte": ogni Titolo H2 è un gruppo, ogni blocco Dettagli è una domanda.

const testo = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, '-')
  .replace(/&hellip;|&#8230;|\[&hellip;\]/g, '…').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slug = s => testo(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Il contenuto lo scrive chi ha accesso a WordPress: togliamo comunque script, iframe e attributi on*
const pulito = html => String(html ?? '')
  .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '').replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
  .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"').trim();
const minuti = html => Math.max(1, Math.round(testo(html).split(' ').length / 200));

async function prendi(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`WordPress ha risposto ${r.status} su ${new URL(url).pathname}`);
  return { dati: await r.json(), pagine: Number(r.headers.get('x-wp-totalpages') ?? 1) };
}

async function articoli(base) {
  const tutti = [];
  for (let p = 1, totale = 1; p <= totale; p++) {
    const { dati, pagine } = await prendi(`${base}/posts?status=publish&per_page=50&page=${p}&_embed=1&orderby=date&order=desc`);
    tutti.push(...dati); totale = pagine;
  }
  return tutti.map(a => {
    const foto = a._embedded?.['wp:featuredmedia']?.[0];
    const categorie = (a._embedded?.['wp:term'] ?? []).flat().filter(t => t.taxonomy === 'category' && t.slug !== 'uncategorized' && t.slug !== 'senza-categoria');
    return {
      slug: a.slug, titolo: testo(a.title?.rendered), sommario: testo(a.excerpt?.rendered),
      data: a.date, autore: a._embedded?.author?.[0]?.name ?? '', categoria: categorie[0]?.name ?? '',
      minuti: minuti(a.content?.rendered), foto: foto?.source_url ?? '', fotoAlt: foto?.alt_text ?? '', html: pulito(a.content?.rendered)
    };
  });
}

async function domande(base) {
  const { dati } = await prendi(`${base}/pages?slug=domande-e-risposte&status=publish`);
  const pagina = dati[0];
  if (!pagina) return null;
  const html = pulito(pagina.content?.rendered);
  const pezzi = html.split(/<h2[^>]*>/i);
  const intro = testo((pezzi[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i) ?? [])[1]);
  const gruppi = pezzi.slice(1).map(p => {
    const [titolo, resto = ''] = p.split(/<\/h2>/i);
    const voci = [...resto.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)]
      .map(m => ({ domanda: testo(m[1]), risposta: m[2].trim() }));
    return { id: slug(titolo), titolo: testo(titolo), voci };
  }).filter(g => g.voci.length);
  return { titolo: testo(pagina.title?.rendered), intro, gruppi };
}

export function indirizzo() { return (process.env.WORDPRESS_API ?? '').trim().replace(/\/+$/, '') || null; }

export async function contenuti(base) {
  const [a, d] = await Promise.all([articoli(base), domande(base)]);
  return { articoli: a, faq: d };
}
