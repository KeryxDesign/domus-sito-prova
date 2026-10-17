<?php
/**
 * Plugin Name: Domus, sezioni per Luana
 * Description: Tre sezioni nel pannello: Articoli, Domande frequenti, Immobili venduti. Il sito le legge dall'API REST.
 *
 * Sta nel repo domus-sito-prova (wordpress/mu-plugins) e la Action la carica in cms/wp-content/mu-plugins:
 * le modifiche si fanno nel repo, non sul server.
 * Gli immobili venduti si inseriscono a mano: niente dati copiati dal gestionale.
 */
if (!defined('ABSPATH')) exit;

const DOMUS_SEDI = ['treviglio' => 'Treviglio', 'martinengo' => 'Martinengo', 'collecchio' => 'Collecchio'];
const DOMUS_CAMPI_VENDUTO = [
	'zona'  => ['Zona', 'Come appare sulla card, per esempio: Treviglio, centro'],
	'tempo' => ['Riga dei tempi', 'Per esempio: Venduta in 45 giorni'],
	'esito' => ['Riga del risultato', 'Per esempio: Prezzo finale 230.000 euro'],
	'sede'  => ['Sede', 'La sede che ha seguito la vendita: la card compare anche nella sua pagina'],
];

add_action('init', function () {
	register_post_type('domanda', [
		'labels' => [
			'name' => 'Domande frequenti', 'singular_name' => 'Domanda', 'menu_name' => 'Domande frequenti',
			'add_new' => 'Aggiungi domanda', 'add_new_item' => 'Nuova domanda', 'edit_item' => 'Modifica domanda',
			'all_items' => 'Tutte le domande', 'search_items' => 'Cerca domande', 'not_found' => 'Nessuna domanda',
		],
		'description' => 'Titolo = domanda, testo = risposta. Il gruppo decide in quale blocco della pagina compare.',
		'public' => true, 'publicly_queryable' => false, 'exclude_from_search' => true, 'rewrite' => false, 'show_ui' => true, 'show_in_rest' => true, 'rest_base' => 'domande',
		'menu_position' => 6, 'menu_icon' => 'dashicons-editor-help',
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

	register_post_type('venduto', [
		'labels' => [
			'name' => 'Immobili venduti', 'singular_name' => 'Immobile venduto', 'menu_name' => 'Immobili venduti',
			'add_new' => 'Aggiungi venduto', 'add_new_item' => 'Nuovo immobile venduto', 'edit_item' => 'Modifica immobile venduto',
			'all_items' => 'Tutti i venduti', 'search_items' => 'Cerca venduti', 'not_found' => 'Nessun immobile venduto',
			'featured_image' => 'Foto della casa', 'set_featured_image' => 'Scegli la foto della casa',
		],
		'description' => 'Le card "Case che abbiamo venduto": in home le più recenti, nella pagina di ogni sede le sue.',
		'public' => true, 'publicly_queryable' => false, 'exclude_from_search' => true, 'rewrite' => false, 'show_ui' => true, 'show_in_rest' => true, 'rest_base' => 'venduti',
		'menu_position' => 7, 'menu_icon' => 'dashicons-admin-home',
		'supports' => ['title', 'thumbnail', 'page-attributes', 'revisions', 'custom-fields'],
	]);
	foreach (DOMUS_CAMPI_VENDUTO as $chiave => $campo) {
		register_post_meta('venduto', "domus_$chiave", [
			'type' => 'string', 'single' => true, 'show_in_rest' => true,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback' => fn() => current_user_can('edit_posts'),
		]);
	}
});

// Gli Articoli restano i post di WordPress: cambiamo solo il nome nel menu.
add_action('admin_menu', function () {
	global $menu;
	foreach ($menu as $i => $voce) if (($voce[2] ?? '') === 'edit.php') $menu[$i][0] = 'Articoli';
	remove_menu_page('edit-comments.php');
});

add_action('add_meta_boxes_venduto', function () {
	add_meta_box('domus_venduto', 'Dati della card', function ($post) {
		wp_nonce_field('domus_venduto', 'domus_venduto_nonce');
		echo '<p>Il titolo serve solo a te per riconoscerla, sul sito non compare. Ordine: nel riquadro Attributi, numero più basso = prima.</p>';
		foreach (DOMUS_CAMPI_VENDUTO as $chiave => [$etichetta, $aiuto]) {
			$valore = get_post_meta($post->ID, "domus_$chiave", true);
			echo '<p><label for="domus_' . $chiave . '"><strong>' . esc_html($etichetta) . '</strong></label><br>';
			if ($chiave === 'sede') {
				echo '<select id="domus_sede" name="domus_sede"><option value="">Nessuna</option>';
				foreach (DOMUS_SEDI as $id => $nome) echo '<option value="' . $id . '"' . selected($valore, $id, false) . '>' . $nome . '</option>';
				echo '</select>';
			} else {
				echo '<input class="widefat" id="domus_' . $chiave . '" name="domus_' . $chiave . '" value="' . esc_attr($valore) . '">';
			}
			echo '<br><span class="description">' . esc_html($aiuto) . '</span></p>';
		}
	}, 'venduto', 'normal', 'high');
});

add_action('save_post_venduto', function ($id) {
	if (!isset($_POST['domus_venduto_nonce']) || !wp_verify_nonce($_POST['domus_venduto_nonce'], 'domus_venduto')) return;
	if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
	if (!current_user_can('edit_post', $id)) return;
	foreach (array_keys(DOMUS_CAMPI_VENDUTO) as $chiave) {
		$valore = sanitize_text_field(wp_unslash($_POST["domus_$chiave"] ?? ''));
		if ($chiave === 'sede' && !isset(DOMUS_SEDI[$valore])) $valore = '';
		update_post_meta($id, "domus_$chiave", $valore);
	}
});
