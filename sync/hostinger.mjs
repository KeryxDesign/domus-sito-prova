// Mette online _site/ sul sito di prova su Hostinger con l'API ufficiale (https://developers.hostinger.com).
//   node sync/hostinger.mjs <dominio>     per esempio domus.keryxdesign.com
// Il token arriva solo dal Secret HOSTINGER_API_TOKEN e non si stampa mai. Il repo è pubblico e i log delle Action
// si vedono: si stampano solo dominio, esito e dimensione; utente e chiavi di caricamento si mascherano.
import { readFileSync, statSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  const archivio = join(RADICE, 'sito.zip');
  rmSync(archivio, { force: true });
  execFileSync('zip', ['-qr', archivio, '.'], { cwd: join(RADICE, '_site') });
  const dim = statSync(archivio).size;
  const su = await api('POST', '/files/upload-urls', { username: sito.username, domain: dominio });
  maschera(su.auth_key); maschera(su.rest_auth_key);
  const h = { 'X-Auth': su.auth_key, 'X-Auth-Rest': su.rest_auth_key, 'Tus-Resumable': '1.0.0' };
  const dest = `${su.url.replace(/\/+$/, '')}/sito.zip?override=true`;
  let r = await fetch(dest, { method: 'POST', headers: { ...h, 'Upload-Length': String(dim), 'Upload-Offset': '0' } });
  if (r.status !== 201) throw new Error(`Caricamento non avviato (${r.status}).`);
  r = await fetch(dest, { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': '0' }, body: readFileSync(archivio) });
  if (r.status !== 204 || Number(r.headers.get('upload-offset')) !== dim) throw new Error(`Caricamento incompleto (${r.status}).`);
  await api('POST', `/accounts/${sito.username}/websites/${dominio}/deploy`, { archive_path: 'sito.zip' });
  rmSync(archivio, { force: true });
  console.log(`${dominio}: pubblicato (${Math.round(dim / 1024)} KB).`);
}

pubblica(process.argv[2]).catch(e => { console.error(e.message); process.exit(1); });
