// Sfondi delle sezioni sempre alterni, con una regola sola per tutte le pagine (17/10/2026).
// Si guardano le sezioni visibili nell'ordine in cui compaiono: quella che ripete il fondo della precedente passa all'altro (bianco <-> grigio).
// Una sezione verde subito dopo un'altra verde, o attaccata al piede (verde anche lui), diventa bianca o grigia.
// Nelle pagine resta scritto il fondo pensato (b, g, v): qui si corregge solo quando due fondi uguali finiscono vicini, per esempio dopo che una sezione sparisce.
(function () {
  const FONDI = ['b', 'g', 'v'];
  const altro = f => f === 'g' ? 'b' : 'g';

  function sistema() {
    const main = document.querySelector('main');
    if (!main) return;
    const sezioni = [...main.querySelectorAll('section.sz')]
      .filter(s => !s.parentElement.closest('section.sz') && s.getClientRects().length);
    let prima = null;
    sezioni.forEach((s, i) => {
      if (!s.dataset.fondo) s.dataset.fondo = FONDI.find(f => s.classList.contains(f)) || (s.classList.contains('vs') ? 'vs' : 'b');
      let f = s.dataset.fondo;
      // la fascia verde stretta (trustbar) resta com'è
      if (f !== 'vs') {
        const ultima = i === sezioni.length - 1 && document.querySelector('.pd');
        if (f === 'v' && (prima === 'v' || prima === 'vs' || ultima)) f = altro(prima);
        else if (f !== 'v' && f === prima) f = altro(f);
        FONDI.forEach(x => s.classList.toggle(x, x === f));
      }
      prima = f;
    });
  }

  // la pagina si disegna dopo il caricamento e alcune parti arrivano dopo: si ricontrolla a ogni cambio
  new MutationObserver(sistema).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('resize', sistema);
  if (document.readyState !== 'loading') sistema();
  else document.addEventListener('DOMContentLoaded', sistema);
})();
