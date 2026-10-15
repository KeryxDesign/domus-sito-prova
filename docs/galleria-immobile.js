// 2.5 Scheda immobile: un clic su una foto la apre a schermo intero; frecce, tasti e scorrimento per le altre
(function () {
  let dlg, img, conta, foto = [], i = 0;

  function crea() {
    dlg = document.createElement('dialog');
    dlg.className = 'im-visore';
    dlg.innerHTML = '<button class="im-v-chiudi" type="button" aria-label="Chiudi le foto">×</button>' +
      '<button class="im-v-prec" type="button" aria-label="Foto precedente">‹</button>' +
      '<img alt="">' +
      '<button class="im-v-succ" type="button" aria-label="Foto successiva">›</button>' +
      '<p class="im-v-conta" aria-live="polite"></p>';
    document.body.appendChild(dlg);
    img = dlg.querySelector('img');
    conta = dlg.querySelector('.im-v-conta');
    dlg.querySelector('.im-v-chiudi').onclick = () => dlg.close();
    dlg.querySelector('.im-v-prec').onclick = () => vai(i - 1);
    dlg.querySelector('.im-v-succ').onclick = () => vai(i + 1);
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') vai(i - 1);
      if (e.key === 'ArrowRight') vai(i + 1);
    });
    let x0 = null;
    dlg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) vai(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  function vai(n) {
    i = (n + foto.length) % foto.length;
    img.src = foto[i].src;
    img.alt = foto[i].alt;
    conta.textContent = (i + 1) + ' / ' + foto.length;
  }

  function apri(ph) {
    const gal = ph.closest('.im-galleria');
    foto = [...gal.querySelectorAll('.ph > img')];
    if (!dlg) crea();
    dlg.showModal();
    vai(foto.indexOf(ph.querySelector('img')));
  }

  document.addEventListener('click', e => {
    const ph = e.target.closest && e.target.closest('.im-galleria .ph');
    if (ph && ph.querySelector('img')) apri(ph);
  });
  document.addEventListener('keydown', e => {
    const ph = e.target.closest && e.target.closest('.im-galleria .ph');
    if (ph && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); apri(ph); }
  });
  // le foto diventano raggiungibili da tastiera quando la pagina e' pronta
  const prepara = () => document.querySelectorAll('.im-galleria .ph:has(> img)').forEach(ph => {
    ph.tabIndex = 0;
    ph.setAttribute('role', 'button');
  });
  new MutationObserver(prepara).observe(document.documentElement, { childList: true, subtree: true });
  prepara();
})();
