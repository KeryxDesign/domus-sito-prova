# Sincronizzazione con onOffice

Il sito pubblicato si costruisce da `docs/` più gli immobili letti da onOffice. La build gira nella GitHub Action `Pubblica sito di prova` e va dritta su Pages: **i dati degli immobili non finiscono mai nel repo** (il repo è pubblico).

- `genera.mjs` copia `docs/` in `_site/`, riempie la card `SchedaImmobile`, crea una pagina `immobile-<id>.dc.html` per casa dal modello 2-05, aggiorna la lista 2-04 e le pagine sede 2-08.
- `onoffice.mjs` legge l'API (solo lettura, firma HMAC v2). Legge solo immobili con `veroeffentlichen = 1` e scarta i venduti.
- `dati-finti.json` serve quando mancano le chiavi o con `--finti`.
- `agenti.json` è il profilo pubblico degli agenti, a mano, con chiave l'id utente onOffice. Da onOffice si legge solo quale agente segue la casa.
- `sedi.json` collega il comune alla sede (regola provvisoria).

Comandi:
- `node sync/genera.mjs --finti` per provare in locale; poi `cd _site && python3 -m http.server`.
- `node sync/genera.mjs --verifica` stampa solo nomi dei campi, valori permessi delle liste e conteggi. Nessun record.

Chiavi: solo nei Secrets del repo `ONOFFICE_TOKEN` e `ONOFFICE_SECRET`. Non vanno mai scritte in file o log. Tutte le pagine hanno `noindex,nofollow`.
