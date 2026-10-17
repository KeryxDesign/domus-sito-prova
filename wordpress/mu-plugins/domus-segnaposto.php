<?php
/**
 * Plugin Name: Domus, contenuti segnaposto
 * Description: Una sola volta, mette nelle tre sezioni contenuti segnaposto da sostituire: articoli, domande frequenti, immobili venduti.
 *
 * Gira al primo caricamento dopo l'installazione e poi non fa più niente (opzione domus_segnaposto_v1).
 * Se Luana cancella i segnaposto non tornano. Nessun dato vero: numeri a zero, zone indicate solo col comune della sede.
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
	// add_option fallisce se l'opzione c'è già: fa anche da blocco se arrivano due richieste insieme
	if (!post_type_exists('domanda') || !post_type_exists('venduto') || !add_option('domus_segnaposto_v1', gmdate('c'), '', false)) return;
	$autore = (int) (get_users(['role' => 'administrator', 'number' => 1, 'fields' => 'ID'])[0] ?? 0);
	$p = fn($t) => "<!-- wp:paragraph -->\n<p>$t</p>\n<!-- /wp:paragraph -->\n";
	$h = fn($t) => "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">$t</h2>\n<!-- /wp:heading -->\n";

	// Articoli: titoli e sommari del prototipo, testo tutto segnaposto
	$articoli = [
		['Quanto vale davvero la tua casa: come si fa una valutazione scritta', 'Confronto con le case vendute in zona, stato dell\'immobile, piano e condominio. Ecco cosa entra nel conto, voce per voce.', 'Vendere'],
		['I documenti da preparare prima di mettere in vendita', 'Atto di provenienza, planimetria, APE, conformità urbanistica: cosa serve, dove si chiede e quanto tempo ci vuole.', 'Vendere'],
		['Perché alzare il prezzo "per trattare" allunga i tempi', 'Una casa sopra il prezzo di mercato riceve meno visite nelle prime settimane, quelle che contano di più.', 'Vendere'],
		['Prima casa: le agevolazioni fiscali spiegate semplici', 'Imposta di registro ridotta, credito d\'imposta, requisiti e scadenze da rispettare per non perderle.', 'Comprare'],
		['Proposta d\'acquisto e compromesso: cosa firmi, e quando', 'Le differenze tra i due documenti, la caparra, e cosa succede se qualcuno si tira indietro.', 'Comprare'],
		['Il mutuo prima della casa: perché chiedere la pre-delibera', 'Sapere quanto ti presta la banca prima di cercare evita di innamorarsi di una casa fuori budget.', 'Comprare']
	];
	foreach ($articoli as $i => [$titolo, $sommario, $categoria]) {
		$cat = term_exists($categoria, 'category') ?: wp_insert_term($categoria, 'category');
		wp_insert_post([
			'post_title' => $titolo, 'post_excerpt' => "Segnaposto. $sommario", 'post_status' => 'publish', 'post_author' => $autore,
			'post_date' => wp_date('Y-m-d H:i:s', time() - $i * DAY_IN_SECONDS),
			'post_category' => is_wp_error($cat) ? [] : [(int) $cat['term_id']],
			'post_content' => $p("Testo segnaposto: qui va il primo paragrafo dell'articolo.")
				. $h('Intertitolo segnaposto') . $p("Testo segnaposto. Gli intertitoli sono i Titoli dell'editor.")
				. $h('Secondo intertitolo segnaposto') . $p('Testo segnaposto da sostituire con il testo di Luana.'),
		]);
	}

	// Domande frequenti: due gruppi, tre domande ciascuno
	foreach (['Per chi vende', 'Per chi compra'] as $gruppo) {
		$g = term_exists($gruppo, 'gruppo_domande') ?: wp_insert_term($gruppo, 'gruppo_domande');
		for ($n = 1; $n <= 3; $n++) {
			$id = wp_insert_post([
				'post_type' => 'domanda', 'post_status' => 'publish', 'post_author' => $autore, 'menu_order' => $n,
				'post_title' => 'Domanda segnaposto ' . $n . ' ' . strtolower($gruppo),
				'post_content' => $p('Risposta segnaposto: qui va la risposta scritta da Luana.'),
			]);
			if ($id && !is_wp_error($g)) wp_set_object_terms($id, [(int) $g['term_id']], 'gruppo_domande');
		}
	}

	// Immobili venduti: due per sede, numeri a zero; ordine alternato così la home ne mostra uno per sede
	$n = 0;
	foreach (['treviglio' => 'Treviglio', 'martinengo' => 'Martinengo', 'collecchio' => 'Collecchio'] as $sede => $comune) {
		$n++;
		for ($k = 1; $k <= 2; $k++) {
			$id = wp_insert_post([
				'post_type' => 'venduto', 'post_status' => 'publish', 'post_author' => $autore, 'menu_order' => $k * 10 + $n,
				'post_title' => "Segnaposto $comune $k",
			]);
			if (!$id || is_wp_error($id)) continue;
			update_post_meta($id, 'domus_zona', "$comune (segnaposto)");
			update_post_meta($id, 'domus_tempo', 'Venduta in 00 giorni');
			update_post_meta($id, 'domus_esito', $k === 1 ? 'Prezzo finale 000.000 euro' : 'Chiesti 000.000, presi 000.000');
			update_post_meta($id, 'domus_sede', $sede);
		}
	}
}, 20);
