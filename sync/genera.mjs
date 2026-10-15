// Genera il sito di prova in _site/ partendo da docs/ e dagli immobili.
//   node sync/genera.mjs             con ONOFFICE_TOKEN e ONOFFICE_SECRET legge onOffice, senza usa sync/dati-finti.json
//   node sync/genera.mjs --finti     usa sempre i dati finti
//   node sync/genera.mjs --verifica  stampa solo struttura e conteggi dell'account onOffice, non genera nulla
// Regole: _site/ non va mai nel repo (è in .gitignore). Il log contiene solo conteggi, mai valori dei record.
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as oo from './onoffice.mjs';

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
const euro = v => num(v) ? Math.round(num(v)).toLocaleString('it-IT').replace(/,/g, '.') + ' euro' : 'Prezzo su richiesta';
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
  const foto = (e.foto ?? []).slice(0, 5);
  const paragrafi = String(e.descrizione ?? '').split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(Boolean);
  const wa = a.whatsapp ? `https://wa.me/${esc(a.whatsapp)}` : '2-11-contatti.dc.html';
  const tel = a.whatsapp ? `<a class="btn alt" href="tel:+${esc(a.whatsapp)}">Chiama</a>` : '';
  const mail = `mailto:${esc(a.email || 'info@domusrealestate.it')}?subject=${encodeURIComponent(e.titolo + (e.codice ? ` (rif. ${e.codice})` : ''))}`;
  // case simili: stessa sede o tipologia, poi le più vicine di prezzo
  const simili = tutti.map((x, i) => ({ x, n: i + 1 })).filter(o => o.n !== n)
    .sort((p, q) => ((q.x.comune === e.comune) - (p.x.comune === e.comune)) || (Math.abs(num(p.x.prezzo) - num(e.prezzo)) - Math.abs(num(q.x.prezzo) - num(e.prezzo))))
    .slice(0, 3).map(o => o.n);

  let s = modello;
  s = sostituisci(s, /<title>[^<]*<\/title>/, `<title>${esc(e.titolo)} · Domus Real Estate</title>`, 'title');
  s = sostituisci(s, /<h1>[^<]*<\/h1>/, `<h1>${esc(titolo)}</h1>`, 'h1');
  s = sostituisci(s, /(<div class="gal galleria im-galleria im-striscia">)[\s\S]*?(<\/div>\s*)(<div class="pan pannello lato">)/,
    (_, a1, a2, a3) => a1 + foto.map((u, i) => `<div class="ph r43"><img src="${esc(u)}" alt="Foto ${i + 1} di ${foto.length} dell’immobile" loading="${i ? 'lazy' : 'eager'}"></div>`).join('') + a2 + a3, 'galleria');
  s = sostituisci(s, /<dd class="prezzo grande">[^<]*<\/dd>/, `<dd class="prezzo grande">${esc(euro(e.prezzo))}</dd>`, 'prezzo');
  const dati = [['Comune', e.comune, 'comune'], ['Superficie', mq(e.superficie), 'superficie'], ['Locali', intero(e.locali), 'locali'], ['Bagni', intero(e.bagni), 'bagni'], ['Piano', piano(e.piano), 'piano'], ['Classe energetica', e.classe, 'classe']]
    .filter(([, v]) => v).map(([k, v, ico]) => `<div data-ico="${ico}"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  s = sostituisci(s, /<dl class="dati">[\s\S]*?<\/dl>/, `<dl class="dati">${dati}</dl>`, 'dati');
  s = sostituisci(s, /<div class="azioni im-barra">[\s\S]*?<\/div>/, `<div class="azioni im-barra"><a class="btn" href="${wa}">Scrivi all’agente</a><a class="btn alt" href="${mail}">Scrivi una mail</a></div>`, 'pulsanti');
  const [primo, ...resto] = paragrafi;
  const desc = `<div class="desc"><p>${esc(primo ?? '')}</p>` + (resto.length ? `<details class="leggi"><summary>Leggi tutto</summary><div class="txt">${resto.map(p => `<p>${esc(p)}</p>`).join('')}</div></details>` : '') + '</div>';
  s = sostituisci(s, /<div class="desc">[\s\S]*?<\/details><\/div>/, desc, 'descrizione');
  // l'agente sta sotto la card grigia del prezzo, con le iniziali e senza foto
  const agente = `<div class="card im-agente-lato"><div class="im-chi"><span class="im-cerchio" aria-hidden="true">${esc(iniziali(a.nome))}</span><div><p class="h3">${esc(a.nome)}</p><p class="small">${esc(a.ruolo)}</p></div></div><p>Ti richiama per fissare giorno e ora della visita. In visita puoi chiedere tutto, anche quello che nell’annuncio non c’è.</p><div class="azioni">${tel}<a class="btn alt" href="${esc(a.pagina)}">Apri la sua pagina</a></div></div>`;
  s = sostituisci(s, /<div class="pan pannello lato">([\s\S]*?)<\/div>(\n<div class="desc">)/,
    (_, dentro, dopo) => `<div class="pan lato im-colonna"><div class="pannello">${dentro}</div>${agente}</div>${dopo}`, 'colonna del prezzo');
  s = sostituisci(s, /<section class="sz g" data-blocco="2\.5 · agente">[\s\S]*?<\/section>\n?/, '', 'sezione agente');
  s = simili.length ? sostituisci(s, griglia, `<div class="grid c3">${imports(simili)}</div>`, 'case simili')
    : sostituisci(s, /<section class="sz b" data-blocco="2\.5 · 10">[\s\S]*?<\/section>/, '', 'case simili');
  return s;
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
  console.log(`Pagine immobile: ${elenco.length}. Per sede: ${Object.entries(conteggioSedi).map(([k, v]) => `${k} ${v}`).join(', ')}. Senza agente in agenti.json: ${elenco.filter(e => !agenti[e.agente]).length}`);
}

main().catch(err => { console.error(String(err.message ?? err)); process.exit(1); });
