# Sincronizzazione con onOffice

Il sito pubblicato si costruisce da `docs/` più gli immobili letti da onOffice. La build gira nella GitHub Action `Pubblica sito di prova` e va dritta su Pages: **i dati degli immobili non finiscono mai nel repo** (il repo è pubblico).

- `genera.mjs` copia `docs/` in `_site/`, riempie la card `SchedaImmobile`, crea una pagina `immobile-<id>.dc.html` per casa dal modello 2-05, aggiorna la lista 2-04 e le pagine sede 2-08.
- `onoffice.mjs` legge l'API (solo lettura, firma HMAC v2). Legge solo immobili con `veroeffentlichen = 1` e scarta i venduti.
- `dati-finti.json` serve quando mancano le chiavi o con `--finti`.
- `agenti.json` è il profilo pubblico degli agenti, a mano, con chiave l'id utente onOffice. Da onOffice si legge solo quale agente segue la casa.
- `sedi.json` collega il comune alla sede (regola provvisoria).

Comandi:
- In locale le chiavi vanno in `.env` alla radice (in .gitignore, mai nel repo), letto da solo dallo script.
- `node sync/genera.mjs --finti` per provare in locale; poi `cd _site && python3 -m http.server`.
- `node sync/genera.mjs --verifica` stampa solo nomi dei campi, valori permessi delle liste e conteggi. Nessun record.

Interruttore: la build usa i dati veri solo se la variabile del repo `ONOFFICE_ATTIVO` vale `si`. Si accende dopo la verifica.

Chiavi: solo nei Secrets del repo `ONOFFICE_TOKEN` e `ONOFFICE_SECRET`. Non vanno mai scritte in file o log. Tutte le pagine hanno `noindex,nofollow`.

## Articoli, domande frequenti, immobili venduti e testimonianze da WordPress

WordPress serve solo come area dove Luana scrive: nessuno visita il sito WordPress, il sito resta questo su Pages. `wordpress.mjs` legge l'API REST pubblica durante la build (solo contenuti pubblicati, nessuna chiave) e `genera.mjs` crea una pagina `articolo-<slug>.dc.html` per articolo dal modello 2-13, riempie la griglia della 2-12, i gruppi della 2-15 le card delle case vendute (in home le prime tre, nella pagina di ogni sede le sue, fino a sei) e le testimonianze.

- Si accende con la variabile del repo `WORDPRESS_API` (Settings, Secrets and variables, Actions, Variables). Esempi: `https://contenuti.<dominio>/wp-json/wp/v2` oppure `https://public-api.wordpress.com/wp/v2/sites/<nome>.wordpress.com`. Senza la variabile queste pagine restano come in `docs/`.
- Nel pannello ci sono quattro sezioni. Tutte tranne Articoli le crea il plugin `wordpress/mu-plugins/domus-sezioni.php`, che la copia su Hostinger carica in `cms/wp-content/mu-plugins/` (si modifica nel repo, non sul server).
  - Articoli: gli articoli pubblicati. La prima categoria fa da etichetta, l'immagine in evidenza è la foto, il riassunto è il sommario.
  - Domande frequenti: titolo = domanda, testo = risposta, Gruppo = blocco della pagina (i gruppi compaiono nell'ordine in cui sono stati creati, le domande col campo Ordine). Senza gruppo vanno in "Altre domande".
  - Testimonianze: titolo = nome come deve comparire, testo = recensione, campi Vendere o comprare, Comune e Stelle, foto facoltativa, ordine col campo Ordine. La 2-16 le mostra tutte divise nei due gruppi; la fascia in fondo alle pagine mostra le prime tre: solo vendere nella 2-02, solo comprare nella 2-03, alternate in home e nelle sedi (la build crea `FasciaTestimonianzeVendere` e `FasciaTestimonianzeComprare`).
  - Immobili venduti: foto in evidenza più i campi Zona, Riga dei tempi, Riga del risultato e Sede, ordine col campo Ordine. Il titolo serve solo a riconoscerli nel pannello. Venduti e testimonianze si inseriscono a mano: niente dati copiati dal gestionale.
- `wordpress/mu-plugins/domus-segnaposto.php` mette una sola volta dei contenuti segnaposto nelle sezioni (numeri a zero, nessun dato vero). Cancellati, non tornano.
- Se una sezione non è ancora attiva (plugin non ancora caricato), la build lo scrive nel log e lascia quella parte come in `docs/`.
- `node sync/genera.mjs --finti --contenuti-prova` mostra le pagine con `contenuti-prova.json`, senza WordPress.

Aggiornamento quando Luana pubblica: il sito si ricostruisce già due volte al giorno e con Run workflow. Per farlo subito, WordPress manda a GitHub l'evento `contenuti-aggiornati` (`POST https://api.github.com/repos/KeryxDesign/domus-sito-prova/dispatches` con `{"event_type":"contenuti-aggiornati"}`), con un token GitHub a grana fine limitato a questo repo (permesso Contents: read and write). Il token sta solo nella configurazione di WordPress, mai nel repo. Basta un plugin di webhook oppure un piccolo snippet su `transition_post_status`.

## Copia su Hostinger

La stessa build carica il sito anche su `darkslategray-scorpion-230635.hostingersite.com` (Hostinger Keryx, job `hostinger` della GitHub Action), con l'API di Hostinger (`hostinger.mjs`). La build resta su GitHub: la chiave onOffice non arriva mai su Hostinger, ci arriva solo il sito già pronto.

- Serve solo il Secret `HOSTINGER_API_TOKEN` (token API creato in hPanel). Senza, il job salta la copia.
- Sito e WordPress stanno sullo stesso indirizzo: il sito nella radice, WordPress nella cartella `/cms` (Luana entra da `/cms/wp-admin`). I file si caricano uno per uno, senza toccare `/cms` né il `.htaccess` di Hostinger; le pagine di case non più in vendita restano sul server finché non si tolgono a mano.
- WordPress: l'API è `https://darkslategray-scorpion-230635.hostingersite.com/cms/wp-json/wp/v2`, già di serie nella build (si cambia con la variabile `WORDPRESS_API`). Se WordPress non risponde, la build va avanti con le pagine come in `docs/`.
- Le case vere seguono lo stesso interruttore `ONOFFICE_ATTIVO` di Pages: DomuSync ha dato l'ok anche per Hostinger (Davide, 15/10/2026).
- Il dominio si cambia con la variabile `HOSTINGER_DOMINIO`.
