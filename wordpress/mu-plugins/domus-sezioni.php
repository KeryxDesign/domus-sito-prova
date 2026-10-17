<?php
/**
 * Plugin Name: Domus, sezioni per Luana
 * Description: Quattro sezioni nel pannello: Articoli, Domande frequenti, Immobili venduti, Testimonianze. Il sito le legge dall'API REST.
 *
 * Sta nel repo domus-sito-prova (wordpress/mu-plugins) e la Action la carica in cms/wp-content/mu-plugins:
 * le modifiche si fanno nel repo, non sul server.
 * Immobili venduti e testimonianze si inseriscono a mano: niente dati copiati dal gestionale.
 */
if (!defined('ABSPATH')) exit;

const DOMUS_SEDI = ['treviglio' => 'Treviglio', 'martinengo' => 'Martinengo', 'collecchio' => 'Collecchio'];
// Campi delle schede, per sezione: chiave => [etichetta, aiuto, scelte (solo per i menu a tendina)]
const DOMUS_CAMPI = [
	'venduto' => [
		'titolo' => 'Dati della card',
		'nota'   => 'Il titolo serve solo a te per riconoscerla, sul sito non compare. Ordine: nel riquadro Attributi, numero più basso = prima.',
		'campi'  => [
			'zona'  => ['Zona', 'Come appare sulla card, per esempio: Treviglio, centro'],
			'tempo' => ['Riga dei tempi', 'Per esempio: Venduta in 45 giorni'],
			'esito' => ['Riga del risultato', 'Per esempio: Prezzo finale 230.000 euro'],
			'sede'  => ['Sede', 'La sede che ha seguito la vendita: la card compare anche nella sua pagina', DOMUS_SEDI],
		],
	],
	'testimonianza' => [
		'titolo' => 'Dati della testimonianza',
		'nota'   => 'Nel titolo il nome come deve comparire (per esempio: Giulia R.), nel testo la recensione. Ordine: nel riquadro Attributi, numero più basso = prima.',
		'campi'  => [
			'tipo'   => ['Vendere o comprare', 'Decide dove compare: pagina Vendere casa o Comprare casa, e il gruppo nella pagina Testimonianze', ['vendere' => 'Ha venduto casa', 'comprare' => 'Ha comprato casa']],
			'dove'   => ['Comune', 'Per esempio: Treviglio'],
			'stelle' => ['Stelle', 'Da 1 a 5', ['5' => '5', '4' => '4', '3' => '3', '2' => '2', '1' => '1']],
		],
	],
];

add_action('init', function () {
	$nascosto = ['public' => true, 'publicly_queryable' => false, 'exclude_from_search' => true, 'rewrite' => false, 'show_ui' => true, 'show_in_rest' => true];

	register_post_type('domanda', $nascosto + [
		'labels' => [
			'name' => 'Domande frequenti', 'singular_name' => 'Domanda', 'menu_name' => 'Domande frequenti',
			'add_new' => 'Aggiungi domanda', 'add_new_item' => 'Nuova domanda', 'edit_item' => 'Modifica domanda',
			'all_items' => 'Tutte le domande', 'search_items' => 'Cerca domande', 'not_found' => 'Nessuna domanda',
		],
		'description' => 'Titolo = domanda, testo = risposta. Il gruppo decide in quale blocco della pagina compare.',
		'rest_base' => 'domande', 'menu_position' => 6, 'menu_icon' => 'dashicons-editor-help',
		'supports' => ['title', 'editor', 'page-attributes', 'revisions'],
	]);
	register_taxonomy('gruppo_domande', 'domanda', [
		'labels' => [
			'name' => 'Gruppi', 'singular_name' => 'Gruppo', 'menu_name' => 'Gruppi',
			'add_new_item' => 'Nuovo gruppo', 'edit_item' => 'Modifica gruppo', 'all_items' => 'Tutti i gruppi',
		],
		'public' => true, 'publicly_queryable' => false, 'rewrite' => false, 'show_ui' => true, 'show_in_rest' => true, 'rest_base' => 'gruppi-domande',
		'hierarchical' => true, 'show_admin_column' => true,
	]);

	register_post_type('venduto', $nascosto + [
		'labels' => [
			'name' => 'Immobili venduti', 'singular_name' => 'Immobile venduto', 'menu_name' => 'Immobili venduti',
			'add_new' => 'Aggiungi venduto', 'add_new_item' => 'Nuovo immobile venduto', 'edit_item' => 'Modifica immobile venduto',
			'all_items' => 'Tutti i venduti', 'search_items' => 'Cerca venduti', 'not_found' => 'Nessun immobile venduto',
			'featured_image' => 'Foto della casa', 'set_featured_image' => 'Scegli la foto della casa',
		],
		'description' => 'Le card "Case che abbiamo venduto": in home le prime, nella pagina di ogni sede le sue.',
		'rest_base' => 'venduti', 'menu_position' => 7, 'menu_icon' => 'dashicons-admin-home',
		'supports' => ['title', 'thumbnail', 'page-attributes', 'revisions', 'custom-fields'],
	]);

	register_post_type('testimonianza', $nascosto + [
		'labels' => [
			'name' => 'Testimonianze', 'singular_name' => 'Testimonianza', 'menu_name' => 'Testimonianze',
			'add_new' => 'Aggiungi testimonianza', 'add_new_item' => 'Nuova testimonianza', 'edit_item' => 'Modifica testimonianza',
			'all_items' => 'Tutte le testimonianze', 'search_items' => 'Cerca testimonianze', 'not_found' => 'Nessuna testimonianza',
			'featured_image' => 'Foto della persona', 'set_featured_image' => 'Scegli la foto (facoltativa)',
		],
		'description' => 'Titolo = nome, testo = recensione. Vendere o comprare decide dove compare.',
		'rest_base' => 'testimonianze', 'menu_position' => 8, 'menu_icon' => 'dashicons-format-quote',
		'supports' => ['title', 'editor', 'thumbnail', 'page-attributes', 'revisions', 'custom-fields'],
	]);

	foreach (DOMUS_CAMPI as $tipo => $scheda) {
		foreach ($scheda['campi'] as $chiave => $campo) {
			register_post_meta($tipo, "domus_$chiave", [
				'type' => 'string', 'single' => true, 'show_in_rest' => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback' => fn() => current_user_can('edit_posts'),
			]);
		}
	}
});

// Gli Articoli restano i post di WordPress: cambiamo solo il nome nel menu.
add_action('admin_menu', function () {
	global $menu;
	foreach ($menu as $i => $voce) if (($voce[2] ?? '') === 'edit.php') $menu[$i][0] = 'Articoli';
	remove_menu_page('edit-comments.php');
});

// Testimonianze: niente editor a blocchi, basta un riquadro di testo
add_filter('use_block_editor_for_post_type', fn($usa, $tipo) => $tipo === 'testimonianza' ? false : $usa, 10, 2);

foreach (DOMUS_CAMPI as $tipo => $scheda) {
	add_action("add_meta_boxes_$tipo", function () use ($tipo, $scheda) {
		add_meta_box("domus_$tipo", $scheda['titolo'], function ($post) use ($tipo, $scheda) {
			wp_nonce_field("domus_$tipo", "domus_{$tipo}_nonce");
			echo '<p>' . esc_html($scheda['nota']) . '</p>';
			foreach ($scheda['campi'] as $chiave => $campo) {
				[$etichetta, $aiuto] = $campo;
				$valore = get_post_meta($post->ID, "domus_$chiave", true);
				echo '<p><label for="domus_' . $chiave . '"><strong>' . esc_html($etichetta) . '</strong></label><br>';
				if (isset($campo[2])) {
					echo '<select id="domus_' . $chiave . '" name="domus_' . $chiave . '"><option value="">Scegli</option>';
					foreach ($campo[2] as $id => $nome) echo '<option value="' . esc_attr($id) . '"' . selected($valore, (string) $id, false) . '>' . esc_html($nome) . '</option>';
					echo '</select>';
				} else {
					echo '<input class="widefat" id="domus_' . $chiave . '" name="domus_' . $chiave . '" value="' . esc_attr($valore) . '">';
				}
				echo '<br><span class="description">' . esc_html($aiuto) . '</span></p>';
			}
		}, $tipo, 'normal', 'high');
	});

	add_action("save_post_$tipo", function ($id) use ($tipo, $scheda) {
		if (!isset($_POST["domus_{$tipo}_nonce"]) || !wp_verify_nonce($_POST["domus_{$tipo}_nonce"], "domus_$tipo")) return;
		if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
		if (!current_user_can('edit_post', $id)) return;
		foreach ($scheda['campi'] as $chiave => $campo) {
			$valore = sanitize_text_field(wp_unslash($_POST["domus_$chiave"] ?? ''));
			if (isset($campo[2]) && !isset($campo[2][$valore])) $valore = '';
			update_post_meta($id, "domus_$chiave", $valore);
		}
	});
}
