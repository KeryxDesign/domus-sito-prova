// Mette online _site/ sul sito di prova su Hostinger con l'API ufficiale (https://developers.hostinger.com).
//   node sync/hostinger.mjs <dominio>     per esempio darkslategray-scorpion-230635.hostingersite.com (sito + WordPress in /cms)
// Il token arriva solo dal Secret HOSTINGER_API_TOKEN e non si stampa mai. Il repo è pubblico e i log delle Action
// si vedono: si stampano solo dominio, esito e dimensione; utente e chiavi di caricamento si mascherano.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://developers.hostinger.com/api/hosting/v1';
const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.HOSTINGER_API_TOKEN;
const maschera = v => { if (v && process.env.GITHUB_ACTIONS) console.log(`::add-mask::${v}`); return v; };

async function api(metodo, percorso, corpo) {
  const r = await fetch(BASE + percorso, {
    method: metodo,
    headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json', ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const testo = await r.text();
  if (!r.ok) {
    let msg = ''; try { msg = JSON.parse(testo).message ?? ''; } catch {}
    throw new Error(`Hostinger ha risposto ${r.status} su ${metodo} ${percorso.split('?')[0].replace(/\/accounts\/[^/]+/, '/accounts/…')}${msg ? ': ' + msg : ''}`);
  }
  return testo ? JSON.parse(testo) : {};
}

async function pubblica(dominio) {
  if (!TOKEN) throw new Error('Manca il Secret HOSTINGER_API_TOKEN.');
  const d = await api('GET', `/websites?per_page=100&domain=${encodeURIComponent(dominio)}`);
  const sito = (Array.isArray(d) ? d : d.data ?? []).find(s => s.domain === dominio);
  if (!sito) throw new Error(`${dominio}: sito non trovato su Hostinger.`);
  maschera(sito.username);
  // Il sito sta nella radice dello stesso sito Hostinger che ha WordPress in /cms: si caricano i file uno per uno,
  // senza il deploy dell'archivio, così /cms e il .htaccess di Hostinger restano come sono.
  // più il plugin delle sezioni di WordPress (wordpress/ nel repo va in cms/wp-content/ sul server)
  const file = [...elenca(join(RADICE, '_site')).map(rel => [join(RADICE, '_site', rel), rel]),
    ...elenca(join(RADICE, 'wordpress')).map(rel => [join(RADICE, 'wordpress', rel), `cms/wp-content/${rel}`])];
  const su = await api('POST', '/files/upload-urls', { username: sito.username, domain: dominio });
  maschera(su.auth_key); maschera(su.rest_auth_key);
  const h = { 'X-Auth': su.auth_key, 'X-Auth-Rest': su.rest_auth_key, 'Tus-Resumable': '1.0.0' };
  const base = su.url.replace(/\/+$/, '');
  let byte = 0;
  const carica = async ([sorgente, rel]) => {
    const dati = readFileSync(sorgente);
    const dest = `${base}/${rel.split('/').map(encodeURIComponent).join('/')}?override=true`;
    for (let prova = 1; ; prova++) {
      try {
        let r = await fetch(dest, { method: 'POST', headers: { ...h, 'Upload-Length': String(dati.length), 'Upload-Offset': '0' } });
        if (r.status !== 201) throw new Error(`avvio ${r.status}`);
        r = await fetch(dest, { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': '0' }, body: dati });
        if (r.status !== 204) throw new Error(`invio ${r.status}`);
        byte += dati.length; return;
      } catch (e) { if (prova >= 3) throw new Error(`${rel}: caricamento non riuscito (${e.message}).`); }
    }
  };
  for (let i = 0; i < file.length; i += 6) await Promise.all(file.slice(i, i + 6).map(carica));
  console.log(`${dominio}: pubblicati ${file.length} file (${Math.round(byte / 1024)} KB).`);
}

function elenca(cartella, pre = '') {
  return readdirSync(join(cartella, pre), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? elenca(cartella, join(pre, d.name)) : d.name === '.DS_Store' ? [] : [join(pre, d.name)]);
}

pubblica(process.argv[2]).catch(e => { console.error(e.message); process.exit(1); });
