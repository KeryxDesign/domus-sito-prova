// 2.9 Agente: il modulo "Scrivi all'agente" si riempie con la casa da cui si arriva.
// La scheda immobile apre la pagina con ?casa=<titolo>&rif=<codice>#scrivi (link scritto da sync/genera.mjs).
(function () {
  const parametri = new URLSearchParams(location.search);
  const casa = (parametri.get('casa') || '').slice(0, 200);
  const rif = (parametri.get('rif') || '').slice(0, 40);
  if (!casa && !rif) return;

  function riempi() {
    const f = document.getElementById('modulo-agente');
    if (!f || f.dataset.pieno) return !!f;
    f.dataset.pieno = '1';
    const metti = (nome, valore) => { const c = f.elements[nome]; if (c) c.value = valore; };
    const quale = casa + (rif ? ` (rif. ${rif})` : '');
    metti('casa', casa);
    metti('rif', rif);
    metti('oggetto', `Richiesta di informazioni: ${quale}`);
    if (!f.elements.messaggio.value) metti('messaggio', `Buongiorno, vorrei sapere di più sulla casa ${quale}. `);
    // la pagina si disegna dopo il caricamento: l'ancora #scrivi va raggiunta quando il modulo c'è
    if (location.hash === '#scrivi') document.getElementById('scrivi')?.scrollIntoView();
    return true;
  }

  if (!riempi()) {
    const osserva = new MutationObserver(() => { if (riempi()) osserva.disconnect(); });
    osserva.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
