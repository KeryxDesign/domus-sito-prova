// Barra per chi scrive i testi: apre il Google Doc della pagina mostrata.
// Solo nel repo, non in Claude Design. L'accesso ai Doc lo decidono i permessi di Drive.
(function () {
  var DOC = 'https://docs.google.com/document/d/';
  var CARTELLA = 'https://drive.google.com/drive/folders/1j3zdTH8qi08LE9fL5U8iCRB4SaclpfAJ';
  var COMUNI = '1sUtutqtQAc2a-sIdzXFW2XdPpKMtOgr5Uqb31FeJv2U';
  var PAGINE = {
    '0-indice': '1K_ap41D4tpH62Q8hK35bqucUe1CaiCuehjaGAujOgG4',
    '2-01-home': '1ka2HqOLiO1EDASyu8pjMVl2AfDburziLxYRd6MQSH_E',
    '2-02-vendere-casa': '1a6aRZKwADb-P2oq4DR7VHymHVyUFJdH3ieCI7dnfAPk',
    '2-03-comprare-casa': '15E-V_uSjSyQG4EGY7xetlexovAiirSZ7Tiw7DQWETTE',
    '2-04-immobili-in-vendita': '1-UkVXRCFZDR4HI9NOX4GcmlnVvELleZiQvPnyeW-uvk',
    '2-05-scheda-immobile': '1ZWX2pUWfzqiFoS8cPRJ2RgbZ2rBEs7lrgYWbSHTN5k4',
    '2-06-chi-siamo': '1PuHn0oT1CTlQ_tjq3XOg-yVoLXCiESq3HVWg87TfeLc',
    '2-07-sedi': '1TI-Ix8gahdsF3elJsrN1oTQ1RLFkdaF581LFAtb-17s',
    '2-08-sede-collecchio': '1UkNXSYkubi4QzLf8yTvrPYaHvTPj5Jjd7662oxZY7QA',
    '2-08-sede-martinengo': '1H-uN6KKqOJy1woV1QnTlHMbXPSKky4QKybRh2yWvqJI',
    '2-08-sede-treviglio': '1eOdKD8B4yI4gdx3YkJOtQitAGgr3NxtJ1Y-uA1ro8qI',
    '2-09-agente': '11JJVGiy1LihxSHaTf28Pa9fkO-TAUnvmBeIXLakABt8',
    '2-10-lavora-con-noi': '1PeVUec-vZw48kVmBCTYbmn6j3meu2xyLCnDrTF9WJ1U',
    '2-11-contatti': '1OYQD8LatL2BAz3RgLYINxrlowMaKJhOqgeeMSKlmK4I',
    '2-12-approfondimenti': '1Dj_BqGZbHJ3FlU-NufGL4wkS-AsMB_p-0_y3pCT1GbQ',
    '2-13-articolo': '1CRTazLcE8FfNGveDSTykiSra0wumXXvUgZGBhNIqNHE',
    '2-14-metodo': '1elyQ1wuj9KD6pMcf39OTuxboaHyP8NP28USnLJJOazc',
    '2-15-domande-e-risposte': '1EdlVs83KL7CQRakqpevjsYMSwY-kdHpWdhwVWL2W4I8',
    '2-16-testimonianze': '1dOWGN1jnZvTp-f6HN6OovYWFjbrlg8G4ROEvDQ9hDYU',
    '2-17-risorse-gratuite': '1546yfx0eZ90s0ngX2weQmCgMEpdCFuCACAdTeC0SPW4',
    '2-18-grazie-candidatura': '1cOqIZValyWSfvp2cj5-dwbdTUJ1X_2yf-cvr6GHHHGs',
    '2-18-grazie-contatto': '1Qr-po21umFOumQaOiQb18vEdbw-wiDsdaJj8ruCEEFY',
    '2-18-grazie-immobile': '1V2Aej7qbfyUFZDa99gJVQeo1JEvbUvrjf2kb3GLCiWQ',
    '2-18-grazie-risorsa': '1ItYcdK9T-V6nmQvW843ajtMYKC6QdsN0oYjoloPZLic',
    '2-18-grazie-valutazione': '1seNvAu1kZXL6Uujr5h4v9ZoO5uUofN5AQXfHmR8Mudg',
    '2-19-privacy-e-cookie': '1d_vJQDZlFH08Hm17MBluhVL84w_56r4AbO2dqbQ8XvI',
    '2-20-mappa-del-sito': '1aEaKqLFRkGmxMHT7BOPfdchyfkz-lEDV7fGg1pPnu2I'
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
