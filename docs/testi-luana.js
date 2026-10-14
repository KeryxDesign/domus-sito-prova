// Barra per chi scrive i testi: apre il Google Doc della pagina mostrata.
// Solo nel repo, non in Claude Design. L'accesso ai Doc lo decidono i permessi di Drive.
(function () {
  var DOC = 'https://docs.google.com/document/d/';
  var CARTELLA = 'https://drive.google.com/drive/folders/1j3zdTH8qi08LE9fL5U8iCRB4SaclpfAJ';
  var COMUNI = '1N7V-7j3SnAi2i3gj1cnkzIr6v8HK6ecV8gUP1Km8yHM';
  var PAGINE = {
    '0-indice': '1PbtV4LrFcESdM3KvzISymZzV0_WskvlrQolyPvjKXpw',
    '2-01-home': '1YrP8B7AjjUHuuLJSGvfkr5zwcui7Gf429WxbpJMnc5Y',
    '2-02-vendere-casa': '1yhqIjprukrHe3HQBhhRkSLZ3ipidj-kkq4TCcfpbwhc',
    '2-03-comprare-casa': '1dT7OitJ-4HtYl_6wpwYURGR_WY6Ogziuet2sSb35lvY',
    '2-04-immobili-in-vendita': '1tO9YXhrsxbfygXeR1jMppRnTd40W9wnvI0dkqhxYMuE',
    '2-05-scheda-immobile': '1075aERvcyLwDKd_2vOhe2V4-DALzu60zy4ncTr3YxSY',
    '2-06-chi-siamo': '13fr80OrFnW4ccWoXL3tZWeI2aBZdK93QdHI8Mri5wgk',
    '2-07-sedi': '14eazHxn2McS2gPSkLt9R_e0kOtglPsbthiUnqTisEtQ',
    '2-08-sede-collecchio': '1F_U6r8zKAnsem_Rzj_eAA6MWkUkjat03D-F2vJhk7lQ',
    '2-08-sede-martinengo': '1a2yk6MOWGbPreI7yZbgB_pyRdezRcgKmDzuxrE65uV4',
    '2-08-sede-treviglio': '1p6kGv2w4bP1KL0lXtXaCfqETJOvNDYHxNx9Jj86ovJA',
    '2-09-agente': '13zRODi3AiLcZ-gTHCC-WD_hOv0Et6uZn22evdMyQvbs',
    '2-10-lavora-con-noi': '1d6QNcTUp9ujiy31_yeoczLT1LIIlWF8lS6NB6zOiXRU',
    '2-11-contatti': '1IEclUZLqmFNYliGAiavQSpNDX1xIBGvmlmMuZdnwh0w',
    '2-12-approfondimenti': '1fJyZB0t6bVGWjv7x38mm9hGSxE7WbLHuZihuXFFrsC8',
    '2-13-articolo': '167o4nw4F99HCbpfpM_efcDcyPsx7KWEUF5GdnJ4vc9g',
    '2-14-metodo': '1UvhDf7_WGQJnsUjc_nG3HRkBaTxV_tzVSws8fp3wcXU',
    '2-15-domande-e-risposte': '1af__XAjzQ9bD-GpegqYmFw0a78lXDEnBcSkaX1zbjxY',
    '2-16-testimonianze': '1f6GnQ95dBJaSK8g-ehCHJnDqye9PQTeSxiquuzjvBVA',
    '2-17-risorse-gratuite': '1KhTZGQNfpUnFL8RgPN8zPXKc7Jzo30PHNvJReUP4KyI',
    '2-18-grazie-candidatura': '1bXjudO29VOxMa8fgit3vO07ldkF__JQqeI-YVN5_FFw',
    '2-18-grazie-contatto': '1rkGj5oW9nb9joB23A90MfRyB8MvhljLqqxiLI7lJZLk',
    '2-18-grazie-immobile': '1MoQBJjh-ijsn9mGzLHlRcCvU6msZ6iWI4P2n52S6uec',
    '2-18-grazie-risorsa': '1ywwVqQo7FGdulCzZSwAk1pugstXUzIOiZv2Ys9AHRxc',
    '2-18-grazie-valutazione': '1HymB8lJR_nVTp79JVCRt3qnccSqREgUYftQ_L28cjwk',
    '2-19-privacy-e-cookie': '14UKTtSgU-y_Uo0X4QxMc7XmcTciRdEHyZjHID8wkWTQ',
    '2-20-mappa-del-sito': '1tk3wxdiDQ6Xx5gJodbggtblKlB_Mk_LvSnPIVi8yGds'
  };

  function link(testo, href) {
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = testo;
    a.style.cssText = 'color:#fff;text-decoration:underline;margin-right:14px;white-space:nowrap';
    return a;
  }

  function monta() {
    if (document.getElementById('testi-luana')) return;
    var nome = location.pathname.split('/').pop().replace('.dc.html', '');
    var id = PAGINE[nome];
    var barra = document.createElement('div');
    barra.id = 'testi-luana';
    barra.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;' +
      'background:#1a1a1a;color:#fff;font:14px/1.4 system-ui,sans-serif;' +
      'padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.3);max-width:calc(100% - 24px)';
    barra.appendChild(link(id ? 'Testo di questa pagina' : 'Questa pagina non ha ancora un Doc: apri la cartella', id ? DOC + id + '/edit' : CARTELLA));
    barra.appendChild(link('Menu e piede', DOC + COMUNI + '/edit'));
    var chiudi = document.createElement('button');
    chiudi.type = 'button';
    chiudi.textContent = '×';
    chiudi.setAttribute('aria-label', 'Nascondi');
    chiudi.style.cssText = 'background:none;border:0;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 4px';
    chiudi.onclick = function () { barra.remove(); };
    barra.appendChild(chiudi);
    document.body.appendChild(barra);
    var stampa = document.createElement('style');
    stampa.textContent = '@media print{#testi-luana{display:none}}';
    document.head.appendChild(stampa);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
