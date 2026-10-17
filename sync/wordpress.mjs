// Legge articoli, domande frequenti, immobili venduti e testimonianze da un WordPress usato solo come area di scrittura (headless).
// Si legge l'API REST pubblica: solo contenuti pubblicati, nessuna chiave. Le bozze di Luana restano in WordPress.
//   WORDPRESS_API  indirizzo base dell'API, per esempio
//                  https://contenuti.esempio.it/wp-json/wp/v2           (WordPress su hosting)
//                  https://public-api.wordpress.com/wp/v2/sites/xxx.wordpress.com   (sito WordPress.com)
// Le sezioni del pannello (tutte tranne Articoli le crea wordpress/mu-plugins/domus-sezioni.php):
//   Articoli           = post pubblicati; la prima categoria diventa l'etichetta (Vendere, Comprare); immagine in evidenza = foto.
//   Domande frequenti  = titolo domanda, testo risposta, Gruppo = blocco della pagina; ordine col campo Ordine.
//   Immobili venduti   = foto in evidenza più i campi Zona, Riga dei tempi, Riga del risultato, Sede; ordine col campo Ordine.
//   Testimonianze      = titolo nome, testo recensione, campi Vendere o comprare, Comune, Stelle; foto facoltativa; ordine col campo Ordine.

const testo = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, '-')
  .replace(/&hellip;|&#8230;|\[&hellip;\]/g, '…').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Il contenuto lo scrive chi ha accesso a WordPress: togliamo comunque script, iframe e attributi on*
const pulito = html => String(html ?? '')
  .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '').replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
  .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"').trim();
const minuti = html => Math.max(1, Math.round(testo(html).split(' ').length / 200));

async function prendi(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  // 404 = sezione non ancora attiva (il plugin non è ancora sul server): si va avanti senza
  if (r.status === 404) return { dati: null, pagine: 0 };
  if (!r.ok) throw new Error(`WordPress ha risposto ${r.status} su ${new URL(url).pathname}`);
  return { dati: await r.json(), pagine: Number(r.headers.get('x-wp-totalpages') ?? 1) };
}

async function tutti(url) {
  const lista = [];
  for (let p = 1, totale = 1; p <= totale; p++) {
    const { dati, pagine } = await prendi(`${url}&per_page=100&page=${p}`);
    if (!dati) return null;
    lista.push(...dati); totale = pagine;
  }
  return lista;
}

async function articoli(base) {
  const lista = await tutti(`${base}/posts?status=publish&_embed=1&orderby=date&order=desc`) ?? [];
  return lista.map(a => {
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
  const [voci, gruppi] = await Promise.all([
    tutti(`${base}/domande?status=publish&orderby=menu_order&order=asc`),
    tutti(`${base}/gruppi-domande?orderby=id&order=asc&hide_empty=true`)]);
  if (!voci || !gruppi) return null;
  // i gruppi compaiono nell'ordine in cui sono stati creati; le domande senza gruppo vanno in "Altre domande"
  const blocchi = [...gruppi.map(g => ({ id: g.slug, titolo: testo(g.name), termine: g.id, voci: [] })),
    { id: 'altre-domande', titolo: 'Altre domande', termine: null, voci: [] }];
  for (const v of voci) {
    const b = blocchi.find(g => (v['gruppi-domande'] ?? []).includes(g.termine)) ?? blocchi.at(-1);
    b.voci.push({ domanda: testo(v.title?.rendered), risposta: pulito(v.content?.rendered) });
  }
  return { gruppi: blocchi.filter(g => g.voci.length).map(({ termine, ...g }) => g) };
}

async function venduti(base) {
  const lista = await tutti(`${base}/venduti?status=publish&_embed=1&orderby=menu_order&order=asc`);
  if (!lista) return null;
  return lista.map(v => {
    const foto = v._embedded?.['wp:featuredmedia']?.[0];
    const m = v.meta ?? {};
    return { zona: testo(m.domus_zona), tempo: testo(m.domus_tempo), esito: testo(m.domus_esito),
      sede: String(m.domus_sede ?? ''), foto: foto?.source_url ?? '', fotoAlt: foto?.alt_text ?? '' };
  }).filter(v => v.zona || v.esito);
}

async function testimonianze(base) {
  const lista = await tutti(`${base}/testimonianze?status=publish&_embed=1&orderby=menu_order&order=asc`);
  if (!lista) return null;
  return lista.map(t => {
    const m = t.meta ?? {};
    const stelle = Math.min(5, Math.max(1, parseInt(m.domus_stelle, 10) || 5));
    return { nome: testo(t.title?.rendered), testo: testo(t.content?.rendered), dove: testo(m.domus_dove), stelle,
      tipo: ['vendere', 'comprare'].includes(m.domus_tipo) ? m.domus_tipo : '', foto: t._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '' };
  }).filter(t => t.nome && t.testo && t.tipo);
}

export function indirizzo() { return (process.env.WORDPRESS_API ?? '').trim().replace(/\/+$/, '') || null; }

export async function contenuti(base) {
  const [a, d, v, t] = await Promise.all([articoli(base), domande(base), venduti(base), testimonianze(base)]);
  return { articoli: a, faq: d, venduti: v, testimonianze: t };
}
