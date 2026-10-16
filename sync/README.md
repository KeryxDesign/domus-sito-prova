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

## Articoli e domande frequenti da WordPress

WordPress serve solo come area dove Luana scrive: nessuno visita il sito WordPress, il sito resta questo su Pages. `wordpress.mjs` legge l'API REST pubblica durante la build (solo contenuti pubblicati, nessuna chiave) e `genera.mjs` crea una pagina `articolo-<slug>.dc.html` per articolo dal modello 2-13, riempie la griglia della 2-12 e i gruppi della 2-15.

- Si accende con la variabile del repo `WORDPRESS_API` (Settings, Secrets and variables, Actions, Variables). Esempi: `https://contenuti.<dominio>/wp-json/wp/v2` oppure `https://public-api.wordpress.com/wp/v2/sites/<nome>.wordpress.com`. Senza la variabile le pagine 2-12, 2-13 e 2-15 restano come in `docs/`.
- In WordPress: gli articoli sono gli Articoli pubblicati (la prima categoria fa da etichetta, l'immagine in evidenza è la foto, il riassunto è il sommario). Le domande stanno nella Pagina con slug `domande-e-risposte`: ogni Titolo H2 è un gruppo, ogni blocco Dettagli è una domanda con la risposta dentro.
- `node sync/genera.mjs --finti --contenuti-prova` mostra le pagine con `contenuti-prova.json`, senza WordPress.

Aggiornamento quando Luana pubblica: il sito si ricostruisce già due volte al giorno e con Run workflow. Per farlo subito, WordPress manda a GitHub l'evento `contenuti-aggiornati` (`POST https://api.github.com/repos/KeryxDesign/domus-sito-prova/dispatches` con `{"event_type":"contenuti-aggiornati"}`), con un token GitHub a grana fine limitato a questo repo (permesso Contents: read and write). Il token sta solo nella configurazione di WordPress, mai nel repo. Basta un plugin di webhook oppure un piccolo snippet su `transition_post_status`.

## Copia su Hostinger

La stessa build carica il sito anche su `domus.keryxdesign.com` (Hostinger Keryx, job `hostinger` della GitHub Action), con l'API di Hostinger (`hostinger.mjs`). La build resta su GitHub: la chiave onOffice non arriva mai su Hostinger, ci arriva solo il sito già pronto.

- Serve solo il Secret `HOSTINGER_API_TOKEN` (token API creato in hPanel). Senza, il job salta la copia.
- WordPress sta su `contenuti.keryxdesign.com`, installato da Hostinger nella cartella `/cms`: l'API è `https://contenuti.keryxdesign.com/cms/wp-json/wp/v2`, già di serie nella build (si cambia con la variabile `WORDPRESS_API`). Se WordPress non risponde, la build va avanti con le pagine come in `docs/`.
- Le case vere seguono lo stesso interruttore `ONOFFICE_ATTIVO` di Pages: DomuSync ha dato l'ok anche per Hostinger (Davide, 15/10/2026).
- Il dominio si cambia con la variabile `HOSTINGER_DOMINIO`.
