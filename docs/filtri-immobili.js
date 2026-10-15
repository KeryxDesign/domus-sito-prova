// Filtri della lista immobili (2-04). I dati arrivano da indice-immobili.js, scritto da sync/genera.mjs.
// Lavora sulle card già disegnate da support.js: nasconde quelle che non corrispondono e le riordina.
(function () {
  const dati = window.DOMUS_IMMOBILI || [];
  const parametri = new URLSearchParams(location.search);
  const cifra = v => { const n = parseInt(String(v || '').replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };
  const filtro = {
    comune: parametri.get('comune') || '', tipologia: parametri.get('tipologia') || '',
    prezzo: cifra(parametri.get('prezzo')), locali: cifra(parametri.get('locali')),
    superficie: cifra(parametri.get('superficie')), ordine: parametri.get('ordine') || ''
  };
  const ordini = { '': 'Più recenti', 'prezzo-su': 'Prezzo più basso', 'prezzo-giu': 'Prezzo più alto', 'mq-giu': 'Superficie più grande' };

  const corrisponde = i =>
    (!filtro.comune || i.comune === filtro.comune) &&
    (!filtro.tipologia || i.tipologia === filtro.tipologia) &&
    (!filtro.prezzo || (i.prezzo !== null && i.prezzo <= filtro.prezzo)) &&
    (!filtro.locali || (i.locali !== null && i.locali >= filtro.locali)) &&
    (!filtro.superficie || (i.superficie !== null && i.superficie >= filtro.superficie));
  const confronti = {
    'prezzo-su': (a, b) => (a.prezzo ?? Infinity) - (b.prezzo ?? Infinity),
    'prezzo-giu': (a, b) => (b.prezzo ?? -1) - (a.prezzo ?? -1),
    'mq-giu': (a, b) => (b.superficie ?? -1) - (a.superficie ?? -1)
  };

  function opzioni(select, voci, scelta) {
    if (!select || select.dataset.pieno) return;
    select.dataset.pieno = '1';
    for (const [valore, testo] of voci) {
      const o = document.createElement('option');
      o.value = valore; o.textContent = testo;
      if (String(valore) === String(scelta)) o.selected = true;
      select.appendChild(o);
    }
  }
  const unici = campo => [...new Set(dati.map(i => i[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));

  function moduli() {
    for (const form of document.querySelectorAll('form[action^="2-04-immobili-in-vendita"]')) {
      opzioni(form.querySelector('select[name="comune"]'), unici('comune').map(c => [c, c]), filtro.comune);
      opzioni(form.querySelector('select[name="tipologia"]'), unici('tipologia').map(c => [c, c]), filtro.tipologia);
      opzioni(form.querySelector('select[name="locali"]'), [1, 2, 3, 4, 5].map(n => [n, n === 1 ? 'Almeno 1 locale' : `Almeno ${n} locali`]), filtro.locali);
      const ordine = form.querySelector('select[name="ordine"]');
      if (ordine && !ordine.dataset.pieno) { ordine.innerHTML = ''; opzioni(ordine, Object.entries(ordini), filtro.ordine); }
      const prezzo = form.querySelector('input[name="prezzo"]');
      if (prezzo && filtro.prezzo && !prezzo.value) prezzo.value = filtro.prezzo.toLocaleString('it-IT');
      const mq = form.querySelector('input[name="superficie"]');
      if (mq && filtro.superficie && !mq.value) mq.value = filtro.superficie;
      if (form.closest('.im-filtri') && !form.dataset.auto) {
        // nella lista i filtri si applicano appena cambiano, senza pulsante
        form.dataset.auto = '1';
        form.addEventListener('change', () => {
          for (const campo of form.elements) if (campo.name && !campo.value) campo.disabled = true;
          form.submit();
        });
      }
    }
  }

  function lista() {
    const griglia = document.querySelector('.im-conteggio ~ * .grid.c3, .grid.c3');
    const conteggio = document.querySelector('.im-conteggio');
    if (!griglia || !conteggio || !dati.length) return false;
    const card = [...griglia.children];
    const pagina = el => (el.querySelector('a[href^="immobile-"]') || {}).getAttribute?.('href');
    if (card.length < dati.length || card.some(c => !pagina(c))) return false;
    const perPagina = Object.fromEntries(dati.map(i => [i.pagina, i]));
    let scelte = card.map(c => ({ c, i: perPagina[pagina(c)] })).filter(x => x.i);
    for (const x of scelte) x.c.hidden = !corrisponde(x.i);
    if (confronti[filtro.ordine]) scelte = scelte.sort((a, b) => confronti[filtro.ordine](a.i, b.i));
    for (const x of scelte) griglia.appendChild(x.c);
    const n = scelte.filter(x => !x.c.hidden).length;
    const filtrato = ['comune', 'tipologia', 'prezzo', 'locali', 'superficie'].some(k => filtro[k]);
    conteggio.textContent = n === 1 ? '1 casa in vendita' : `${n} case in vendita`;
    if (filtrato && n) conteggio.textContent += ' con questi filtri';
    if (!n && !document.querySelector('.im-vuoto-filtri')) {
      const p = document.createElement('div');
      p.className = 'pannello im-vuoto im-vuoto-filtri';
      p.innerHTML = '<h2>Ops, non abbiamo trovato nulla con questi filtri</h2><p>Prova a togliere un filtro o ad alzare il prezzo massimo. Oppure fatti richiamare da un agente di zona.</p><div class="azioni"><a class="btn" href="2-11-contatti.dc.html">Richiamatemi</a></div>';
      griglia.after(p);
    }
    return true;
  }

  let fatto = false;
  const prova = () => { moduli(); if (!fatto) fatto = lista(); };
  const osserva = new MutationObserver(prova);
  const avvia = () => { prova(); osserva.observe(document.body, { childList: true, subtree: true }); setTimeout(() => osserva.disconnect(), 15000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
