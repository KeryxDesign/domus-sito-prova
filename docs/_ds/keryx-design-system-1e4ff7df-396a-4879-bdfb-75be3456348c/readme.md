# Keryx Design — sistema visivo per chi costruisce

Serve all'agente che disegna una pagina Keryx: classi da usare, pagine da copiare.
Non spiega il brand a un umano — quello è `../sistema_visivo.md`.

**Il criterio, e sta sopra a tutto:** la misura di un pezzo a risposta diretta è la
sua leggibilità. Qui dentro non c'è una scelta di gusto: ogni valore è letto da una
fonte, e la fonte sta nel commento accanto.

## Come si usa

1. Copia `templates/pagina-di-vendita/index.html` e collega `styles.css`. È l'unico
   foglio che una pagina collega.
2. Sostituisci il testo col copy approvato del tuo progetto. ⛔ Non si scrive copy qui.
3. Numeri, prezzi e testimonianze restano `[tra parentesi]` finché non arrivano da
   `clienti/keryx/documento_madre.md`. Un numero inventato dentro un file di codice
   esce credibile, ed è per questo che è più pericoloso di un numero storpiato.
4. Se ti serve un componente che non è in tabella, guarda `decisioni/caselle-aperte.html`:
   probabilmente manca apposta. Se non c'è nemmeno lì, ti fermi e lo chiedi.

⛔ `scheda.css` non si collega mai da una pagina: è solo l'arredo delle schede.

## Direzione

**Saggio, con il Custode sotto.** Il nome è *araldo*: chi porta l'annuncio e lo dice
chiaro. L'araldo annuncia la battaglia, il protagonista è un altro — quindi la pagina
non urla e non si mette al centro. La promessa è «saprai», mai «funzionerà».

Da qui discendono tre cose che si vedono a schermo:

- **Ogni affermazione esce con la sua fonte, o col buco dichiarato.** Un numero senza
  ancora non entra in una pagina, e non entra nemmeno in questo sistema.
- **In copertina va il pezzo di lavoro**, non il dietro le quinte.
- **Autorevole e non urlante.** Il colore d'azione è uno; l'oro è evidenza, non un
  secondo grido. Il bordo delle card si vede: le cose hanno un contorno.

Fonte: `../archetipo_brand.md` §1-2, `../positioning_keryx.md`.

## Colore

Un colore d'azione solo: **coral** `#D55244`. L'oro è **evidenza**, mai azione.
Chi mette due bottoni pieni di due colori diversi sulla stessa pagina non ha deciso.

| Ruolo | Token | Hex |
|---|---|---|
| Fondo neutro | `--background` | `#FFFFFF` |
| Fondo caldo (ritmo) | `--cream` | `#ECF0F3` |
| Fondo scuro (capitolo) | `--navy` / `--navy-dark` | `#011E32` / `#01121E` |
| Testo | `--foreground` / `--muted-foreground` | `#212022` / `#2B303B` |
| **Azione** | `--coral` / `--coral-hover` | `#D55244` / `#C83D2D` |
| Evidenza su scuro | `--gold` | `#F0B428` |
| Evidenza testuale su chiaro | `--gold-ink` | `#8B5904` |
| Box di evidenza | `--gold-bg` | `#F7EFDE` |
| Bordo | `--border` | `#EDEDED` |

Contrasti ricalcolati dalle triplette HSL di `global.css`: navy su bianco 16,98:1 ·
navy su cream 14,84:1 · gold su navy 9,12:1 · gold-ink su bianco 5,92:1 · gold-ink su
cream 5,17:1.
⛔ **Gold acceso come testo su fondo chiaro: 1,86:1. Mai.** Per quello esiste `gold-ink`.
⚠️ `.btn-coral` è bianco su coral: 4,10:1, sotto il pavimento — casella A2.

**Il logo non entra nella palette.** Porta i colori del Brand Manual (`#003142`,
`#CF9E2A`) e non si ricolora mai. Su fondo scuro pieno va la variante **White**.

## Tipografia

**A schermo:** Playfair Display per i titoli, DM Sans per il corpo. Libre Baskerville
per le citazioni, Source Code Pro per l'uso tecnico. Tutte a licenza aperta.
**Su carta e PDF:** Baskerville per i titoli, Inter per il corpo (Brand Manual, deciso
da Davide il 14/08/2026). Chi progetta dichiara prima su cosa finisce il pezzo.

Pavimento del repo, verificato a 390px: **corpo ≥ 16px, nessun testo sotto i 14px**.
Due eccezioni chiuse a 13px che non si estendono per analogia.
⛔ Nessun testo con `font-weight` ≤ 300.
⚠️ Il conflitto 17/15 contro 16/14 è aperto: fonte unica `sop/grafica/graf_pagina_web.md`
punto 4. Il sistema porta 16/14 perché è quello che la build misura.

Scala: `.kx-h1` 30→50px · `.kx-h2` 30→42px · `.kx-h3` 27px · `.kx-lead` 16→20px ·
`.kx-body` 17px · occhiello 14px (13px dentro una card) · numero display 54px.

## Icone

Tratto, mai riempimento. `viewBox 0 0 24 24`, `currentColor`, spessore 3 per la spunta,
2,5 per le frecce di CTA, 2 per i metadati. 18px dentro un elenco.
Un'icona sostituisce il pallino di un bullet — i bullet a icona sono cosmetics, e si
usano quando possibile. ⛔ Non arredano un titolo.

## Stati di interazione

- **Fuoco:** contorno oro 2px con offset 2px. Uno solo per tutto il sistema, definito
  una volta in `styles.css`. Non si ridefinisce per componente.
- **Hover bottone:** -1px in verticale e ombra colorata accesa.
- **Active:** torna a zero.
- **Disabled:** opacità 0.5, ombra spenta, cursore `not-allowed`.
- **Link di navigazione:** da `muted-foreground` a `navy`. `aria-current="page"` = navy.
- **Card:** il bordo passa a `gold/50`.
- **Movimento:** esiste solo se guida l'occhio verso lettura, prova o CTA. 200-400ms,
  una volta sola, mai in loop. Lo stato nascosto vive solo con `html.js-anim`, così
  senza JS tutto è visibile e il CLS resta zero. `prefers-reduced-motion` azzera tutto.

## Componenti

| Classe | Cos'è | Dove si vede |
|---|---|---|
| `.btn-gold` | Gradiente oro, testo navy. **Evidenza, non azione**: il repo lo usa come primario, il sistema visivo no ⚠️ A2 | `componenti/bottoni.html` |
| `.btn-coral` | **Il bottone d'azione. Uno per pagina** ⚠️ A2 | `componenti/bottoni.html` · template §8, §10 |
| `.btn-outline-navy` | Secondario a contorno | `componenti/bottoni.html` · template §1, §2, §5 |
| `.btn-ghost-on-dark` | Secondario dentro una banda navy | template §8 |
| `.btn-lg` / `.btn-block` | Bottone grande / a tutta larghezza | template §8, §10 |
| `.kx-link-cta` | Secondo invito come link sottolineato | template §2 |
| `.kx-actions` | Fila di CTA, in colonna sotto 640px | template §2, §8 |
| `.kx-card` + `__title` `__body` `__foot` | Card bianca a bordo visibile, prezzo allineato in fondo | `componenti/card.html` · template §5 |
| `.kx-checklist` | Elenco con spunta oro | `componenti/card.html` · template §5 |
| `.kx-article-card` | Card di articolo con immagine 16:9 | `componenti/card.html` |
| `.kx-doc` | Pannello «documento» su carta cream | `componenti/card.html` |
| `.kx-quote` (+ `--on-dark`) | Testimonianza firmata | `componenti/prove.html` · template §3 |
| `.kx-stat__num` (+ `--on-dark`) `.kx-stat__label` | Numero display tabellare | `componenti/prove.html` · template §6 |
| `.kx-accordion` | Domande frequenti, `<details>` nativi | `componenti/apertura-e-tabella.html` · template §7 |
| `.kx-table` | Confronto a due colonne, filetti orizzontali | `componenti/apertura-e-tabella.html` |
| `.kx-header` `.kx-nav` `.kx-nav__link` | Testa alta 64px, sfocata | `componenti/navigazione.html` · template §1 |
| `.kx-footer` `.kx-footer__nav` | Piede navy, marchio White | `componenti/navigazione.html` · template §9 |
| `.kx-sticky-cta` | CTA fissa in basso, solo sotto 1024px | `componenti/navigazione.html` · template §10 |
| `.kx-section` (+ `--tall` `--rule` `--rule-t`) | Banda di sezione, 4rem → 6rem | tutto il template |
| `.kx-container` (+ `--wide` `--read`) | 72 / 64 / 48rem | tutto il template |
| `.kx-split` `.kx-grid-2` `.kx-grid-3` | Griglie 7/5, due colonne, tre colonne | template §2, §3, §5 |
| `.kx-kicker` (+ `--navy` `--on-dark` `--sm`) | Occhiello sopra il titolo | ovunque |
| `.kx-h1` `.kx-h2` `.kx-h3` `.kx-lead` `.kx-body` | Scala di pagina | ovunque |
| `.kx-highlight` | Evidenziatore oro su una parola | template §2 |
| `.drd-article-rich` | Colonna di lettura lunga, 17px | `componenti/articolo.html` |
| `.bg-navy` `.bg-cream` `.bg-marble` `.bg-coral` … | Fondi del ritmo | `fondamenta/spazio-e-griglia.html` |
| `.text-gold-ink` `.text-gold` `.text-navy` … | Colori di testo | `fondamenta/colore.html` |
| `.kx-reveal` `.kx-d1`–`.kx-d4` | Comparsa e stagger 80ms | `styles.css` |
| `.kx-cta-clearance` `.kx-float-clearance` | Buffer della fascia bassa mobile | template §8 |

## Si fa / Non si fa

**Si fa**
- 9-11 fondi alternati lungo la pagina, **adiacenti mai uguali**; le bande navy segnano
  il capitolo, non la sezione.
- **Una CTA piena per pagina, ed è coral.** Il gold è evidenza, non azione: due pieni di
  due colori sulla stessa pagina vogliono dire che non si è deciso. Il secondo invito è
  `.btn-outline-navy` o `.kx-link-cta`. *(`sistema_visivo.md` §2, §4, §7)*
  ⚠️ Il repo fa il contrario in 41 file su 51. Il template segue il sistema visivo — casella A2.
- Il bordo delle card si vede.
- Numeri in una sezione, testimonianze in un'altra.
- Ogni testimonianza pertinente al claim che sostiene, o nessuna testimonianza.
- Apostrofi curvi `U+2019`. Dopo la sostituzione si **ricontano le righe**.
- Il buffer della fascia bassa sul contenitore di sezione.

**Non si fa**
- ⛔ Gold acceso come testo su fondo chiaro.
- ⛔ Due colori d'azione sulla stessa pagina.
- ⛔ Fondi uguali adiacenti.
- ⛔ Ripetere più di **un** elemento visivo dall'ultimo progetto consegnato
  (`clienti/keryx/sop/registro_visivo_progetti.md`). Questo sistema dice cosa *è* Keryx,
  non cosa si deve rifare uguale.
- ⛔ Stock lifestyle generico. Immagini altrui presentate come lavoro nostro.
- ⛔ Un'immagine come riempitivo: emozione, prova o situazione desiderata, o esce.
- ⛔ Scrivere un numero, un prezzo o una testimonianza dentro un file di sistema.
- ⛔ Il buffer dentro il bordo di una card.
- ⛔ Un ID di tracciamento di produzione dentro un file di anteprima: nell'anteprima gli
  script girano davvero e sparano eventi veri da un dominio che non è quello del cliente.
  Markup sì, ID finto. L'ID vero lo mette SENTINEL in build.

## File

```
styles.css      token + componenti — l'unico foglio che le pagine collegano
scheda.css      arredo delle schede, mai collegato da una pagina
theme.json      parametri leggibili da una macchina
thumbnail.html  copertina 1280×854
readme.md       questo file
assets/         keryx-logo.svg · keryx-araldo.svg · marble-bg.webp
fondamenta/     colore · tipografia · spazio-e-griglia · marchio · icone · immagini
componenti/     bottoni · card · navigazione · prove · apertura-e-tabella · articolo
decisioni/      caselle-aperte — cosa manca e chi lo deve dare
templates/      pagina-di-vendita/index.html
```

## Template

**`templates/pagina-di-vendita/index.html`** — pagina intera che si apre e funziona
sulle sole classi di sistema, nessuno `<style>` locale. Dieci blocchi: testa · hero
marble · prove cream · capitolo navy · servizi bianco · numeri cream · domande bianco ·
candidatura navy · piede · CTA fissa mobile. Otto fondi, adiacenti mai uguali.

Il testo strutturale è copy Keryx **già approvato e pubblicato** (`src/pages/it/index.astro`,
`components/ApplyCTA.astro`): serve a far vedere la pagina con la quantità vera di parole,
che è l'unico modo di giudicare una gerarchia. Chi riusa il template lo sostituisce
integralmente col copy approvato del suo progetto.

---

*Costruito da LORI il 30/08/2026 leggendo `../sistema_visivo.md`, `keryx-design/src/styles/global.css`,
`tailwind.config.ts`, 21 componenti Astro e `src/pages/it/index.astro`. Nessun valore è nato qui:
dieci caselle sono rimaste aperte invece di essere riempite.*
