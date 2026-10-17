// Genera il sito di prova in _site/ partendo da docs/ e dagli immobili.
//   node sync/genera.mjs             con ONOFFICE_TOKEN e ONOFFICE_SECRET legge onOffice, senza usa sync/dati-finti.json
//   node sync/genera.mjs --finti     usa sempre i dati finti
//   node sync/genera.mjs --verifica  stampa solo struttura e conteggi dell'account onOffice, non genera nulla
//   node sync/genera.mjs --contenuti-prova  articoli, domande, venduti e testimonianze da sync/contenuti-prova.json invece che da WordPress
// Articoli, domande frequenti, immobili venduti e testimonianze arrivano da WordPress solo se c'è WORDPRESS_API (vedi sync/wordpress.mjs); senza, quelle pagine restano come in docs/.
// Regole: _site/ non va mai nel repo (è in .gitignore). Il log contiene solo conteggi, mai valori dei record.
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as oo from './onoffice.mjs';
import * as wp from './wordpress.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
// Nell'Action le chiavi arrivano dai Secrets. In locale da .env (in .gitignore, mai nel repo): deroga decisa da Davide il 14/10/2026.
if (existsSync(join(RADICE, '.env'))) process.loadEnvFile(join(RADICE, '.env'));
const SORGENTE = join(RADICE, 'docs');
const USCITA = join(RADICE, '_site');
const json = f => JSON.parse(readFileSync(join(RADICE, 'sync', f), 'utf8'));
const leggi = f => readFileSync(join(USCITA, f), 'utf8');
const scrivi = (f, s) => writeFileSync(join(USCITA, f), s);

// Campi immobile che chiediamo a onOffice (mappa_campi_onoffice_2026-10-14). Si chiedono solo quelli che esistono sull'account.
const CAMPI = ['Id', 'objekttitel', 'ort', 'kaufpreis', 'objekttyp', 'objektart', 'objektnr_extern', 'wohnflaeche',
  'anzahl_zimmer', 'anzahl_badezimmer', 'energyClass', 'etage', 'objektbeschreibung', 'verkauft', 'reserviert'];
const LISTE_DA_VERIFICARE = ['energyClass', 'objekttyp', 'objektart', 'heizungsart', 'fahrstuhl'];

// ---------- utilità ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const euro = v => num(v) ? String(Math.round(num(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' euro' : 'Prezzo su richiesta';
const mq = v => num(v) ? `${Math.round(num(v))} mq` : '';
// 0 in onOffice vuol dire campo non compilato: lo trattiamo come vuoto e la riga non si mostra
const pos = v => num(v) > 0 ? num(v) : null;
const intero = v => pos(v) !== null ? String(+pos(v).toFixed(1)).replace('.', ',') : '';
// se i locali mancano li ricaviamo dalla parola usata nell'annuncio (trilocale = 3)
const PAROLE_LOCALI = { monolocale: 1, bilocale: 2, trilocale: 3, quadrilocale: 4, pentalocale: 5 };
const localiDi = e => pos(e.locali) ?? [e.tipologia, e.titolo, e.descrizione]
  .map(t => String(t ?? '').toLowerCase().match(/\b(monolocale|bilocale|trilocale|quadrilocale|pentalocale)\b/))
  .filter(Boolean).map(m => PAROLE_LOCALI[m[1]])[0] ?? null;
const PIANI = ['Piano terra', 'Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto', 'Sesto', 'Settimo', 'Ottavo', 'Nono', 'Decimo'];
const piano = v => { const n = num(v); return n === null ? '' : (PIANI[n] ?? `${n}°`); };
const iniziali = nome => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
const etichetta = v => { const s = String(v ?? '').replace(/_/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };
const paginaDi = e => `immobile-${String(e.id).replace(/[^a-zA-Z0-9-]/g, '')}.dc.html`;
function sostituisci(testo, cerca, metti, dove) {
  if (!new RegExp(cerca.source, cerca.flags.replace("g", "")).test(testo)) throw new Error(`Struttura cambiata, non trovo ${dove}. Va aggiornato sync/genera.mjs.`);
  return testo.replace(cerca, metti);
}

// ---------- verifica (SENTINEL): solo struttura e conteggi ----------
async function verifica(cred) {
  const campi = await oo.campiImmobile(cred);
  console.log(`Campi immobile sull'account: ${Object.keys(campi).length}`);
  for (const c of [...CAMPI, 'heizungsart', 'fahrstuhl', 'hausgeld', 'bezugsfrei', 'verfuegbar_ab', 'multiParkingLot', 'energieausweistyp']) {
    console.log(`  ${c}: ${campi[c] ? 'presente, tipo ' + campi[c].type : 'ASSENTE'}`);
  }
  for (const c of LISTE_DA_VERIFICARE) {
    const pv = campi[c]?.permittedvalues;
    if (pv) console.log(`  valori permessi di ${c} (configurazione, non record): ${Object.keys(pv).join(', ')}`);
  }
  const presenti = CAMPI.filter(c => campi[c]);
  const rec = await chiamaPrimi(cred, presenti);
  console.log(`Immobili pubblicati visibili all'utente API: ${rec.meta.cntabsolute ?? 'n.d.'} (letti per la prova: ${rec.length}, massimo 10)`);
  for (const c of presenti) {
    const pieni = rec.filter(r => { const v = r.elements?.[c]; return v !== undefined && v !== null && v !== '' && v !== '0' && v !== '0.00'; }).length;
    console.log(`  ${c}: compilato in ${pieni} su ${rec.length}`);
  }
  const ids = rec.map(r => r.id);
  const fotoPer = await oo.foto(cred, ids);
  console.log(`Immobili con almeno una foto: ${Object.keys(fotoPer).length} su ${ids.length}`);
  const agPer = await oo.agenti(cred, ids);
  console.log(`Immobili con agente collegato (relazione officer): ${Object.keys(agPer).length} su ${ids.length}; agenti diversi: ${new Set(Object.values(agPer)).size}`);
}
async function chiamaPrimi(cred, campi) {
  return oo.chiama(cred, { actionid: oo.AZIONE.leggi, resourcetype: 'estate', parameters: {
    data: campi, filter: { veroeffentlichen: [{ op: '=', val: 1 }] }, outputlanguage: 'ITA', formatoutput: false, listlimit: 10
  } });
}

// ---------- lettura immobili ----------
async function daOnOffice(cred) {
  const disponibili = await oo.campiImmobile(cred);
  const campi = CAMPI.filter(c => disponibili[c]);
  const rec = await oo.immobili(cred, campi);
  const attivi = rec.filter(r => String(r.elements?.verkauft ?? '0') !== '1');
  const ids = attivi.map(r => r.id);
  const [fotoPer, agPer] = await Promise.all([oo.foto(cred, ids), oo.agenti(cred, ids)]);
  // Le liste arrivano come chiavi tedesche: l'etichetta italiana sta nella configurazione dei campi (labels, ITA).
  const voce = (campo, v) => disponibili[campo]?.permittedvalues?.[v] ?? etichetta(v);
  return attivi.map(r => {
    const e = r.elements ?? {};
    const tipologia = e.objekttyp ? voce('objekttyp', e.objekttyp) : voce('objektart', e.objektart);
    // Il titolo spesso manca nel gestionale: si ripiega su «Tipologia a Comune».
    const titolo = e.objekttitel || [tipologia, e.ort].filter(Boolean).join(' a ') || 'Immobile';
    return {
      id: String(r.id), titolo, comune: e.ort, prezzo: e.kaufpreis,
      tipologia, codice: e.objektnr_extern, superficie: e.wohnflaeche,
      locali: e.anzahl_zimmer, bagni: e.anzahl_badezimmer, classe: e.energyClass, piano: e.etage,
      descrizione: e.objektbeschreibung, agente: agPer[String(r.id)] ?? null, foto: fotoPer[String(r.id)] ?? []
    };
  });
}

// ---------- generazione ----------
function profilo(agenti, id) { return agenti[id] ?? agenti._predefinito; }
// Ogni profilo di agenti.json ha la sua pagina dal modello 2-09; chi non è in agenti.json va sulla pagina di Domus.
const chiaveAgente = (agenti, id) => agenti[id] ? String(id) : '_predefinito';
const paginaAgente = k => k === '_predefinito' ? 'agente-domus.dc.html' : `agente-${k.replace(/[^a-zA-Z0-9-]/g, '')}.dc.html`;
const numeroLeggibile = n => String(n).replace(/^39/, '').replace(/^(\d{3})(\d{3})(\d+)$/, '$1 $2 $3');

function datiCard(e, agenti, sedi) {
  const a = profilo(agenti, e.agente);
  return {
    sede: sedi[e.comune] ?? 'altro', titolo: e.titolo ?? '', comune: e.comune ?? '', prezzo: euro(e.prezzo),
    superficie: mq(e.superficie), locali: intero(e.locali), bagni: intero(e.bagni), classe: e.classe ?? '',
    tipologia: e.tipologia ?? '', codice: e.codice ?? '', agente: a.nome, iniziali: iniziali(a.nome),
    foto: e.foto?.[0] ?? '', collegamento: paginaDi(e)
  };
}

function componente(card) {
  let s = leggi('SchedaImmobile.dc.html');
  s = sostituisci(s, /const elenco = \[[\s\S]*?\n    \];/, () => `const elenco = ${JSON.stringify(card)};`, 'elenco della card');
  s = sostituisci(s, /if \(!c\) return \{[^\n]*\};/, `if (!c) return { esiste: false };`, 'ritorno vuoto della card');
  s = sostituisci(s, /return \{\n      esiste: true,[\s\S]*?\n    \};/, () => `return Object.assign({ esiste: true }, c, {
      titolo: p.titolo || c.titolo, comune: p.comune || c.comune, prezzo: p.prezzo || c.prezzo,
      superficie: p.superficie || c.superficie, locali: p.locali || c.locali, collegamento: p.collegamento || c.collegamento
    });`, 'ritorno della card');
  s = sostituisci(s, /<div class="ph r21" aria-hidden="true" data-campo="foto"><span>[^<]*<\/span><\/div>/,
    '<div class="ph r21" aria-hidden="true" data-campo="foto"><img src="{{ foto }}" alt="" loading="lazy"></div>', 'foto della card');
  for (const [campo, segnaposto] of [['tipologia', 'tipologia'], ['bagni', 'bagni'], ['classe-energetica', 'classe'], ['agente-iniziali', 'iniziali'], ['agente', 'agente']]) {
    s = sostituisci(s, new RegExp(`(data-campo="${campo}">)[^<{]*(<)`), `$1{{ ${segnaposto} }}$2`, `campo ${campo}`);
  }
  scrivi('SchedaImmobile.dc.html', s);
}

const imports = ns => ns.map(n => `<dc-import name="SchedaImmobile" n="${n}" hint-size="100%,520px"></dc-import>`).join('');
const griglia = /<div class="grid c3">(?:<dc-import name="SchedaImmobile"[^>]*><\/dc-import>)+<\/div>/;

function paginaImmobile(modello, e, n, tutti, agenti) {
  const a = profilo(agenti, e.agente);
  const titolo = e.titolo + (e.comune && !e.titolo.includes(e.comune) ? ` a ${e.comune}` : '');
  const foto = (e.foto ?? []).slice(0, 40);
  const paragrafi = String(e.descrizione ?? '').split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(Boolean);
  const wa = a.whatsapp ? `https://wa.me/${esc(a.whatsapp)}` : '2-11-contatti.dc.html';
  const tel = a.whatsapp ? `<a class="btn alt" href="tel:+${esc(a.whatsapp)}">Chiama</a>` : '';
  // il pulsante dell'agente apre la sua pagina con il modulo già pronto per questa casa (modulo-agente.js)
  const scrivi = `${paginaAgente(chiaveAgente(agenti, e.agente))}?${new URLSearchParams({ casa: titolo, ...(e.codice ? { rif: e.codice } : {}) })}#scrivi`;
  const mail = `mailto:${esc(a.email || 'info@domusrealestate.it')}?subject=${encodeURIComponent(e.titolo + (e.codice ? ` (rif. ${e.codice})` : ''))}`;
  // case simili: stessa sede o tipologia, poi le più vicine di prezzo
  const simili = tutti.map((x, i) => ({ x, n: i + 1 })).filter(o => o.n !== n)
    .sort((p, q) => ((q.x.comune === e.comune) - (p.x.comune === e.comune)) || (Math.abs(num(p.x.prezzo) - num(e.prezzo)) - Math.abs(num(q.x.prezzo) - num(e.prezzo))))
    .slice(0, 3).map(o => o.n);

  let s = modello;
  s = sostituisci(s, /<title>[^<]*<\/title>/, `<title>${esc(e.titolo)} · Domus Real Estate</title>`, 'title');
  s = sostituisci(s, /<h1>[^<]*<\/h1>/, `<h1>${esc(titolo)}</h1>`, 'h1');
  s = sostituisci(s, /(<div class="gal galleria im-galleria im-striscia">)[\s\S]*?(<\/div>\s*)(<div class="pan pannello lato">)/,
    (_, a1, a2, a3) => a1 + foto.map((u, i) => {
      // come i portali: una grande e due piccole, sull'ultima quante foto restano; tutte si aprono nel visore
      const extra = i === 0 && foto.length > 1 ? ` data-conta="${foto.length} foto"` : i === 2 && foto.length > 3 ? ` data-altre="+${foto.length - 3} foto"` : '';
      return `<div class="ph r43"${extra}><img src="${esc(u)}" alt="Foto ${i + 1} di ${foto.length} dell’immobile" loading="${i ? 'lazy' : 'eager'}"></div>`;
    }).join('') + a2 + a3, 'galleria');
  s = sostituisci(s, /<script src="\.\/testi-luana\.js" defer><\/script>/, m => `${m}\n<script src="./galleria-immobile.js" defer></script>`, 'script del visore');
  s = sostituisci(s, /<dd class="prezzo grande">[^<]*<\/dd>/, `<dd class="prezzo grande">${esc(euro(e.prezzo))}</dd>`, 'prezzo');
  const dati = [['Comune', e.comune, 'comune'], ['Superficie', mq(e.superficie), 'superficie'], ['Prezzo al mq', pos(e.prezzo) && pos(e.superficie) ? euro(pos(e.prezzo) / pos(e.superficie)) : '', 'eurmq'], ['Locali', intero(e.locali), 'locali'], ['Bagni', intero(e.bagni), 'bagni'], ['Piano', piano(e.piano), 'piano'], ['Classe energetica', e.classe, 'classe']]
    .filter(([, v]) => v).map(([k, v, ico]) => `<div data-ico="${ico}"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  s = sostituisci(s, /<dl class="dati">[\s\S]*?<\/dl>/, `<dl class="dati">${dati}</dl>`, 'dati');
  s = sostituisci(s, /<div class="azioni im-barra">[\s\S]*?<\/div>/, `<div class="azioni im-barra"><a class="btn" href="${wa}">Scrivi all’agente</a><a class="btn alt" href="${mail}">Scrivi una mail</a></div>`, 'pulsanti');
  const [primo, ...resto] = paragrafi;
  // descrizione già tutta aperta, senza «Leggi tutto»
  const desc = `<div class="desc">${[primo ?? '', ...resto].map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
  s = sostituisci(s, /<div class="desc">[\s\S]*?<\/details><\/div>/, desc, 'descrizione');
  // l'agente sta sotto la card grigia del prezzo, con le iniziali e senza foto
  const agente = `<div class="card im-agente-lato"><div class="im-chi"><span class="im-cerchio" aria-hidden="true">${esc(iniziali(a.nome))}</span><div><p class="h3">${esc(a.nome)}</p><p class="small">${esc(a.ruolo)}</p></div></div><p>Ti richiama per fissare giorno e ora della visita. In visita puoi chiedere tutto, anche quello che nell’annuncio non c’è.</p><div class="azioni">${tel}<a class="btn alt" href="${esc(scrivi)}">Apri la sua pagina</a></div></div>`;
  s = sostituisci(s, /<div class="pan pannello lato">([\s\S]*?)<\/div>(\n<div class="desc">)/,
    (_, dentro, dopo) => `<div class="pan lato im-colonna"><div class="pannello">${dentro}</div>${agente}</div>${dopo}`, 'colonna del prezzo');
  s = sostituisci(s, /<section class="sz g" data-blocco="2\.5 · agente">[\s\S]*?<\/section>\n?/, '', 'sezione agente');
  s = simili.length ? sostituisci(s, griglia, `<div class="grid c3">${imports(simili)}</div>`, 'case simili')
    : sostituisci(s, /<section class="sz b" data-blocco="2\.5 · 10">[\s\S]*?<\/section>/, '', 'case simili');
  return s;
}

function paginaDiAgente(modello, k, a, ns) {
  let s = modello;
  s = sostituisci(s, /<title>[^<]*<\/title>/, `<title>${esc(k === '_predefinito' ? 'Scrivi all’agenzia' : a.nome)} · Domus Real Estate</title>`, 'title della 2-09');
  s = sostituisci(s, /<div class="im-iniziali" aria-hidden="true">[^<]*<\/div><div class="st"><h1>[^<]*<\/h1><p class="lead">[^<]*<\/p>/,
    `<div class="im-iniziali" aria-hidden="true">${esc(iniziali(a.nome))}</div><div class="st"><h1>${esc(a.nome)}</h1><p class="lead">${esc(a.ruolo)}</p>`, 'testata della 2-09');
  s = ns.length ? sostituisci(s, griglia, `<div class="grid c3">${imports(ns)}</div>`, 'case della 2-09')
    : sostituisci(s, /<section class="sz g" data-blocco="2\.9 · 6">[\s\S]*?<\/section>\n?/, '', 'case della 2-09');
  const email = a.email || 'info@domusrealestate.it';
  const contatti = (a.whatsapp ? `<a class="btn" href="tel:+${esc(a.whatsapp)}">Chiama ${esc(numeroLeggibile(a.whatsapp))}</a><a class="btn alt" href="https://wa.me/${esc(a.whatsapp)}">Scrivi su WhatsApp</a>` : '')
    + `<a class="btn alt" href="mailto:${esc(email)}">Scrivi una mail</a>`;
  s = sostituisci(s, /(<div class="azioni im-contatti">)[\s\S]*?(<\/div><\/div><\/section>)/, (_, x, y) => x + contatti + y, 'contatti della 2-09');
  return sostituisci(s, /<input type="hidden" name="agente" value="[^"]*">/, `<input type="hidden" name="agente" value="${esc(a.nome)}">`, 'agente del modulo della 2-09');
}

// ---------- articoli e domande (WordPress) ----------
const paginaArticolo = a => `articolo-${String(a.slug).replace(/[^a-z0-9-]/g, '')}.dc.html`;
const dataIt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function cardArticolo(a) {
  const foto = a.foto ? `<img src="${esc(a.foto)}" alt="" loading="lazy">` : '<span>Foto</span>';
  const cat = a.categoria ? `<span class="co-cat">${esc(a.categoria)}</span>` : '';
  return `<a class="card foto co-link co-articolo" href="${paginaArticolo(a)}"><div class="ph r43">${foto}</div><div class="corpo"><p class="co-meta">${cat}<span>${a.minuti} min di lettura</span></p><h2 class="h3">${esc(a.titolo)}</h2><p>${esc(a.sommario)}</p></div></a>`;
}

function articolo(modello, a) {
  let s = sostituisci(modello, /<title>[^<]*<\/title>/, () => `<title>${esc(a.titolo)} · Domus Real Estate</title>`, 'titolo della 2-13');
  const firma = a.autore ? `<div class="agente co-firma"><div class="ph r11" aria-hidden="true"><span>${esc(iniziali(a.autore))}</span></div><div><p class="forte">${esc(a.autore)}</p><p class="small">${esc(dataIt(a.data))}</p></div></div>` : `<p class="small">${esc(dataIt(a.data))}</p>`;
  const foto = a.foto ? `<figure><div class="ph r169"><img src="${esc(a.foto)}" alt="${esc(a.fotoAlt)}"></div></figure>` : '';
  const lead = a.sommario ? `<p class="lead">${esc(a.sommario)}</p>` : '';
  return sostituisci(s, /<h1>[\s\S]*?(?=<\/article>)/, () => `<h1>${esc(a.titolo)}</h1>\n  ${lead}\n  ${firma}\n  ${foto}\n  <div class="co-wp st">${a.html}</div>\n`, 'corpo della 2-13');
}

function domandeFrequenti(s, faq) {
  // titolo e testo d'apertura restano quelli della 2-15; da WordPress arrivano i gruppi e le domande
  const salti = faq.gruppi.map(g => `<a href="#${esc(g.id)}">${esc(g.titolo)}</a>`).join('');
  s = sostituisci(s, /(<h1>[^<]*<\/h1>\s*<p class="lead">[^<]*<\/p>\s*<div class="etichette">)[\s\S]*?(<\/div>)/,
    (_, a, b) => `${a}${salti}${b}`, 'testata della 2-15');
  const gruppi = faq.gruppi.map(g => `<div class="gruppo" id="${esc(g.id)}">\n    <h2>${esc(g.titolo)}</h2>\n    <div>\n${g.voci.map(v =>
    `      <details class="acc"><summary>${esc(v.domanda)}</summary><div>${v.risposta}</div></details>`).join('\n')}\n    </div>\n  </div>`).join('\n');
  return sostituisci(s, /(<section class="sz g" data-blocco="2\.15 · 3 4"><div class="wrap">)[\s\S]*?(<\/div><\/section>)/, (_, a, b) => `${a}\n${gruppi}\n${b}`, 'gruppi della 2-15');
}

function cardVenduto(v, ph) {
  const foto = v.foto ? `<img src="${esc(v.foto)}" alt="${esc(v.fotoAlt || 'Casa venduta')}" loading="lazy">` : '<span>Foto</span>';
  const righe = [['small', v.zona], ['tempo', v.tempo], ['', v.esito]].filter(([, t]) => t)
    .map(([c, t]) => `<p${c ? ` class="${c}"` : ''}>${esc(t)}</p>`).join('');
  return `<div class="card caso foto"><div class="${ph}">${foto}</div><div class="corpo">${righe}</div></div>`;
}

// Le card "case vendute": in home le prime tre, nella pagina di ogni sede le sue (fino a sei).
// Dove non c'è ancora nessun venduto restano le card d'esempio di docs/.
function venduti(lista) {
  const griglia = (f, blocco, scelti, ph) => {
    if (!scelti.length || !existsSync(join(USCITA, f))) return;
    const cerca = new RegExp(`(data-blocco="${blocco.replace(/[.]/g, '\\.')}"[\\s\\S]*?<div class="grid c3">)(?:<div class="card caso foto">[\\s\\S]*?</p></div></div>)+`);
    scrivi(f, sostituisci(leggi(f), cerca, (_, a) => `${a}${scelti.map(v => cardVenduto(v, ph)).join('')}`, `case vendute della ${f}`));
  };
  griglia('2-01-home.dc.html', '2.1 · 5', lista.slice(0, 3), 'ph r43');
  for (const sede of ['treviglio', 'martinengo', 'collecchio'])
    griglia(`2-08-sede-${sede}.dc.html`, '2.8 · 2 3', lista.filter(v => v.sede === sede).slice(0, 6), 'ph r43 ag-da-tablet');
}

function cardTestimonianza(t) {
  const foto = t.foto ? `<img src="${esc(t.foto)}" alt="" width="64" height="64" loading="lazy">` : '';
  return `<figure class="card voce"><span class="stelle" role="img" aria-label="${t.stelle} stelle su 5"><span aria-hidden="true">${'★'.repeat(t.stelle)}</span></span>`
    + `<blockquote><p>${esc(t.testo)}</p></blockquote><figcaption class="voce-testa"><span class="ph voce-foto">${foto}<span>Foto</span></span>`
    + `<span class="voce-chi"><span class="voce-nome">${esc(t.nome)}</span>${t.dove ? `<span class="voce-dove">${esc(t.dove)}</span>` : ''}</span></figcaption></figure>`;
}

// Testimonianze: nella 2-16 tutte, divise tra chi ha venduto e chi ha comprato. La fascia in fondo alle pagine
// mostra le prime tre: solo "vendere" nella 2-02, solo "comprare" nella 2-03, alternate in home e nelle sedi.
// Le figure non contengono div, quindi la griglia finisce al primo </div>.
function testimonianze(lista) {
  const per = tipo => lista.filter(t => t.tipo === tipo);
  const v = per('vendere'), c = per('comprare');
  const f216 = '2-16-testimonianze.dc.html';
  if (existsSync(join(USCITA, f216))) {
    let s = leggi(f216);
    for (const [blocco, voci] of [['2\\.16 · 3"', v], ['2\\.16 · 3-bis"', c]]) {
      if (!voci.length) continue;
      s = sostituisci(s, new RegExp(`(data-blocco="${blocco}[\\s\\S]*?<div class="grid c3">)[\\s\\S]*?(\\s*</div>)`),
        (_, a, b) => `${a}\n      ${voci.map(cardTestimonianza).join('\n      ')}${b}`, `testimonianze della 2-16 (${blocco})`);
    }
    scrivi(f216, s);
  }
  const fascia = leggi('FasciaTestimonianze.dc.html');
  const conVoci = voci => sostituisci(fascia, /(<div class="grid c3">)[\s\S]*?(<\/div>)/, (_, a, b) => `${a}${voci.slice(0, 3).map(cardTestimonianza).join('')}${b}`, 'griglia della FasciaTestimonianze');
  const alternate = [];
  for (let i = 0; alternate.length < 3 && (i < v.length || i < c.length); i++) alternate.push(...[v[i], c[i]].filter(Boolean));
  scrivi('FasciaTestimonianze.dc.html', conVoci(alternate));
  for (const [nome, voci, pagina] of [['FasciaTestimonianzeVendere', v, '2-02-vendere-casa.dc.html'], ['FasciaTestimonianzeComprare', c, '2-03-comprare-casa.dc.html']]) {
    if (!voci.length || !existsSync(join(USCITA, pagina))) continue;
    scrivi(`${nome}.dc.html`, conVoci(voci));
    scrivi(pagina, sostituisci(leggi(pagina), /<dc-import name="FasciaTestimonianze"/, `<dc-import name="${nome}"`, `fascia testimonianze della ${pagina}`));
  }
}

async function contenutiWordPress(prova) {
  const base = wp.indirizzo();
  let c = null;
  try { c = prova ? json('contenuti-prova.json') : base ? await wp.contenuti(base) : null; }
  // se WordPress non risponde il sito si costruisce lo stesso, con le pagine come in docs/
  catch (e) { console.log(`WordPress non raggiungibile (${e.message}): articoli e domande restano come in docs/.`); }
  if (!c) { if (!base || prova) console.log('Articoli e domande: nessun WordPress collegato, pagine lasciate come in docs/.'); return; }
  const arts = c.articoli.filter(a => a.slug && a.titolo);
  if (arts.length) {
    const modello = leggi('2-13-articolo.dc.html');
    for (const a of arts) scrivi(paginaArticolo(a), articolo(modello, a));
    // la 2-13 diventa l'articolo più recente, così i link del menu non mostrano un articolo vuoto
    scrivi('2-13-articolo.dc.html', articolo(modello, arts[0]));
    scrivi('2-12-approfondimenti.dc.html', sostituisci(leggi('2-12-approfondimenti.dc.html'),
      /(<section class="sz g" data-blocco="2\.12 · 4">[\s\S]*?<div class="grid c3">)[\s\S]*?(<\/div>\n<\/div><\/section>)/,
      (_, a, b) => `${a}\n    ${arts.map(cardArticolo).join('\n    ')}\n  ${b}`, 'griglia articoli della 2-12'));
  }
  if (c.faq?.gruppi?.length) scrivi('2-15-domande-e-risposte.dc.html', domandeFrequenti(leggi('2-15-domande-e-risposte.dc.html'), c.faq));
  if (c.venduti?.length) venduti(c.venduti);
  if (c.testimonianze?.length) testimonianze(c.testimonianze);
  const nonAttive = [c.faq ? '' : 'domande', c.venduti ? '' : 'venduti', c.testimonianze ? '' : 'testimonianze'].filter(Boolean);
  console.log(`Fonte contenuti: ${prova ? 'contenuti di prova' : 'WordPress'}. Articoli: ${arts.length}. Domande: ${(c.faq?.gruppi ?? []).reduce((n, g) => n + g.voci.length, 0)}. Venduti: ${c.venduti?.length ?? 0}. Testimonianze: ${c.testimonianze?.length ?? 0}${nonAttive.length ? `. Sezioni non ancora attive in WordPress: ${nonAttive.join(', ')}` : ''}`);
}

async function main() {
  const args = process.argv.slice(2);
  const cred = args.includes('--finti') ? null : oo.credenziali();
  if (args.includes('--verifica')) {
    if (!cred) throw new Error('Per la verifica servono ONOFFICE_TOKEN e ONOFFICE_SECRET.');
    return verifica(cred);
  }
  const elenco = cred ? await daOnOffice(cred) : json('dati-finti.json').immobili;
  console.log(`Fonte: ${cred ? 'onOffice' : 'dati finti'}. Immobili: ${elenco.length}`);
  for (const e of elenco) e.locali = localiDi(e);
  // solo conteggi nel log, mai valori
  console.log('Campi vuoti o a zero:', ['prezzo', 'superficie', 'locali', 'bagni'].map(k => `${k} ${elenco.filter(e => pos(e[k]) === null).length}`).join(', '));
  const agenti = json('agenti.json'), sedi = json('sedi.json');

  rmSync(USCITA, { recursive: true, force: true });
  cpSync(SORGENTE, USCITA, { recursive: true, filter: f => !f.endsWith('.DS_Store') });
  const card = elenco.map(e => datiCard(e, agenti, sedi));
  componente(card);

  const modello = leggi('2-05-scheda-immobile.dc.html');
  elenco.forEach((e, i) => scrivi(paginaDi(e), paginaImmobile(modello, e, i + 1, elenco, agenti)));
  // la 2-05 diventa la scheda del primo immobile, così i link del menu non mostrano una casa finta
  if (elenco.length) scrivi('2-05-scheda-immobile.dc.html', paginaImmobile(modello, elenco[0], 1, elenco, agenti));

  const modelloAgente = leggi('2-09-agente.dc.html');
  for (const k of Object.keys(agenti).filter(k => !k.startsWith('_') || k === '_predefinito')) {
    const ns = elenco.map((e, i) => chiaveAgente(agenti, e.agente) === k ? i + 1 : 0).filter(Boolean);
    scrivi(paginaAgente(k), paginaDiAgente(modelloAgente, k, agenti[k], ns));
  }

  const tuttiN = elenco.map((_, i) => i + 1);
  let lista = leggi('2-04-immobili-in-vendita.dc.html');
  lista = sostituisci(lista, griglia, `<div class="grid c3">${imports(tuttiN)}</div>`, 'griglia della lista');
  lista = sostituisci(lista, /00 case in vendita con questi filtri/, elenco.length === 1 ? '1 casa in vendita' : `${elenco.length} case in vendita`, 'conteggio');
  scrivi('2-04-immobili-in-vendita.dc.html', lista);
  // indice per i filtri della 2-04 (filtri-immobili.js): solo dati già pubblici nelle schede
  const indice = elenco.map(e => ({ pagina: paginaDi(e), comune: e.comune || '', tipologia: etichetta(e.tipologia),
    prezzo: pos(e.prezzo), locali: pos(e.locali), superficie: pos(e.superficie) }));
  scrivi('indice-immobili.js', `window.DOMUS_IMMOBILI = ${JSON.stringify(indice)};\n`);

  const comuni = [...new Set(elenco.map(e => e.comune).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'it'));
  const f203 = '2-03-comprare-casa.dc.html';
  if (existsSync(join(USCITA, f203))) scrivi(f203, sostituisci(leggi(f203), /<option value="">Comune<\/option><\/select>/, `<option value="">Comune</option>${comuni.map(c => `<option>${esc(c)}</option>`).join('')}</select>`, 'comuni della 2-03'));

  const conteggioSedi = {};
  for (const sede of ['treviglio', 'martinengo', 'collecchio']) {
    const f = `2-08-sede-${sede}.dc.html`;
    if (!existsSync(join(USCITA, f))) continue;
    const ns = card.map((c, i) => c.sede === sede ? i + 1 : 0).filter(Boolean);
    conteggioSedi[sede] = ns.length;
    scrivi(f, sostituisci(leggi(f), griglia, `<div class="grid c3">${imports(ns)}</div>`, `griglia di ${f}`));
  }
  await contenutiWordPress(args.includes('--contenuti-prova'));
  for (const js of ['testi-luana.js', 'galleria-immobile.js', 'modulo-agente.js']) versioneScript(js);
  console.log(`Pagine immobile: ${elenco.length}. Per sede: ${Object.entries(conteggioSedi).map(([k, v]) => `${k} ${v}`).join(', ')}. Senza agente in agenti.json: ${elenco.filter(e => !agenti[e.agente]).length}`);
}

// Hostinger tiene in cache i .js: al nome si aggiunge ?v=<impronta del file>, così a ogni modifica il browser prende quello nuovo.
function versioneScript(f) {
  const v = createHash('sha1').update(readFileSync(join(USCITA, f))).digest('hex').slice(0, 10);
  for (const p of readdirSync(USCITA).filter(n => n.endsWith('.html'))) {
    const s = leggi(p);
    if (s.includes(`./${f}"`)) scrivi(p, s.split(`./${f}"`).join(`./${f}?v=${v}"`));
  }
}

main().catch(err => { console.error(String(err.message ?? err)); process.exit(1); });
