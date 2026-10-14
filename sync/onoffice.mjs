// Client minimo per l'API onOffice (https://apidoc.onoffice.de), solo lettura.
// Usa solo fetch e crypto di Node: nessuna dipendenza.
// Token e secret arrivano dalle variabili d'ambiente e non vengono mai stampati.
import { createHmac, randomUUID } from 'node:crypto';

const URL_API = 'https://api.onoffice.de/api/stable/api.php';
const NS = 'urn:onoffice-de-ns:smart:2.5:smartml:action:';
export const AZIONE = { leggi: NS + 'read', prendi: NS + 'get' };
export const RELAZIONE_AGENTE = 'urn:onoffice-de-ns:smart:2.5:relationTypes:estate:user:officer';

export function credenziali() {
  const token = process.env.ONOFFICE_TOKEN;
  const secret = process.env.ONOFFICE_SECRET;
  return token && secret ? { token, secret } : null;
}

// HMAC versione 2: base64(hmac_sha256(timestamp + token + resourcetype + actionid, secret))
function firma({ token, secret }, timestamp, resourcetype, actionid) {
  return createHmac('sha256', secret).update(timestamp + token + resourcetype + actionid).digest('base64');
}

// Esegue una sola azione e restituisce i record. In caso di errore il messaggio
// contiene solo codici e testi d'errore dell'API, mai dati.
export async function chiama(cred, { actionid, resourcetype, resourceid = '', parameters = {} }) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const corpo = {
    token: cred.token,
    request: { actions: [{
      actionid, resourceid, identifier: randomUUID(), resourcetype, timestamp,
      hmac: firma(cred, timestamp, resourcetype, actionid), hmac_version: 2, parameters
    }] }
  };
  const r = await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`onOffice ${resourcetype}: HTTP ${r.status}`);
  const j = await r.json();
  if (j?.status?.code !== 200) throw new Error(`onOffice ${resourcetype}: stato ${j?.status?.code} ${j?.status?.message ?? ''}`);
  const ris = j?.response?.results?.[0];
  if (!ris || ris.status?.errorcode !== 0) throw new Error(`onOffice ${resourcetype}: errore ${ris?.status?.errorcode} ${ris?.status?.message ?? ''}`);
  const rec = ris.data?.records ?? [];
  rec.meta = ris.data?.meta ?? {};
  return rec;
}

// Nomi dei campi immobile che esistono su questo account (solo struttura).
export async function campiImmobile(cred) {
  const rec = await chiama(cred, { actionid: AZIONE.prendi, resourcetype: 'fields', parameters: { modules: ['estate'], labels: true, language: 'ITA' } });
  const modulo = rec.find(x => x.id === 'estate') ?? rec[0];
  return modulo?.elements ?? {};
}

// Tutti gli immobili pubblicati, a pagine da 500.
export async function immobili(cred, campi) {
  const tutti = [];
  for (let offset = 0; ; offset += 500) {
    const rec = await chiama(cred, { actionid: AZIONE.leggi, resourcetype: 'estate', parameters: {
      data: campi, filter: { veroeffentlichen: [{ op: '=', val: 1 }] },
      outputlanguage: 'ITA', formatoutput: false, listlimit: 500, listoffset: offset
    } });
    tutti.push(...rec);
    if (rec.length < 500) return tutti;
  }
}

// Foto per immobile: { idImmobile: [url, ...] }, copertina per prima.
export async function foto(cred, ids) {
  const out = {};
  if (!ids.length) return out;
  const rec = await chiama(cred, { actionid: AZIONE.prendi, resourcetype: 'estatepictures', parameters: {
    estateids: ids, categories: ['Titelbild', 'Foto'], size: '1200x900', language: 'ITA'
  } });
  for (const r of rec) {
    const el = Array.isArray(r.elements) ? r.elements : [r.elements];
    for (const f of el) {
      if (!f?.url) continue;
      const k = String(f.estateid ?? r.id);
      (out[k] ??= []).push(f);
    }
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => (a.type === 'Titelbild' ? -1 : 0) - (b.type === 'Titelbild' ? -1 : 0));
    out[k] = out[k].map(f => f.url);
  }
  return out;
}

// Agente di ogni immobile: { idImmobile: idUtente }. Solo l'id, il profilo sta in sync/agenti.json.
export async function agenti(cred, ids) {
  const out = {};
  if (!ids.length) return out;
  const rec = await chiama(cred, { actionid: AZIONE.prendi, resourcetype: 'idsfromrelation', parameters: {
    parentids: ids, relationtype: RELAZIONE_AGENTE
  } });
  const el = rec[0]?.elements ?? {};
  for (const [k, v] of Object.entries(el)) if (Array.isArray(v) && v.length) out[String(k)] = String(v[0]);
  return out;
}
