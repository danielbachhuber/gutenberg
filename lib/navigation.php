<?php
/**
 * Functions used in making nav menus interopable with block editors.
 *
 * @package gutenberg
 */

/**
 * Registers block editor 'wp_navigation' post type.
 */
function gutenberg_register_navigation_post_type() {
	$labels = array(
		'name'                  => __( 'Navigation Menus', 'gutenberg' ),
		'singular_name'         => __( 'Navigation Menu', 'gutenberg' ),
		'menu_name'             => _x( 'Navigation Menus', 'Admin Menu text', 'gutenberg' ),
		'add_new'               => _x( 'Add New', 'Navigation Menu', 'gutenberg' ),
		'add_new_item'          => __( 'Add New Navigation Menu', 'gutenberg' ),
		'new_item'              => __( 'New Navigation Menu', 'gutenberg' ),
		'edit_item'             => __( 'Edit Navigation Menu', 'gutenberg' ),
		'view_item'             => __( 'View Navigation Menu', 'gutenberg' ),
		'all_items'             => __( 'All Navigation Menus', 'gutenberg' ),
		'search_items'          => __( 'Search Navigation Menus', 'gutenberg' ),
		'parent_item_colon'     => __( 'Parent Navigation Menu:', 'gutenberg' ),
		'not_found'             => __( 'No Navigation Menu found.', 'gutenberg' ),
		'not_found_in_trash'    => __( 'No Navigation Menu found in Trash.', 'gutenberg' ),
		'archives'              => __( 'Navigation Menu archives', 'gutenberg' ),
		'insert_into_item'      => __( 'Insert into Navigation Menu', 'gutenberg' ),
		'uploaded_to_this_item' => __( 'Uploaded to this Navigation Menu', 'gutenberg' ),
		// Some of these are a bit weird, what are they for?
		'filter_items_list'     => __( 'Filter Navigation Menu list', 'gutenberg' ),
		'items_list_navigation' => __( 'Navigation Menus list navigation', 'gutenberg' ),
		'items_list'            => __( 'Navigation Menus list', 'gutenberg' ),
	);

	$args = array(
		'labels'                => $labels,
		'description'           => __( 'Navigation menus.', 'gutenberg' ),
		'public'                => false,
		'has_archive'           => false,
		// We should disable UI for non-FSE themes.
		'show_ui'               => gutenberg_is_fse_theme(),
		'show_in_menu'          => 'themes.php',
		'show_in_admin_bar'     => false,
		'show_in_rest'          => true,
		'map_meta_cap'          => true,
		'rest_base'             => 'navigation',
		'rest_controller_class' => WP_REST_Posts_Controller::class,
		'supports'              => array(
			'title',
			'editor',
			'revisions',
		),
	);

	register_post_type( 'wp_navigation', $args );
}
add_action( 'init', 'gutenberg_register_navigation_post_type' );

/**
 * Disable "Post Attributes" for wp_navigation post type.
 *
 * The attributes are also conditionally enabled when a site has custom templates.
 * Block Theme templates can be available for every post type.
 */
add_filter( 'theme_wp_navigation_templates', '__return_empty_array' );

/**
 * Disable block editor for wp_navigation type posts so they can be managed via the UI.
 *
 * @param bool   $value Whether the CPT supports block editor or not.
 * @param string $post_type Post type.
 *
 * @return bool
 */
function gutenberg_disable_block_editor_for_navigation_post_type( $value, $post_type ) {
	if ( 'wp_navigation' === $post_type ) {
		return false;
	}

	return $value;
}

add_filter( 'use_block_editor_for_post_type', 'gutenberg_disable_block_editor_for_navigation_post_type', 10, 2 );

/**
 * This callback disables the content editor for wp_navigation type posts.
 * Content editor cannot handle wp_navigation type posts correctly.
 * We cannot disable the "editor" feature in the wp_navigation's CPT definition
 * because it disables the ability to save navigation blocks via REST API.
 *
 * @param WP_Post $post An instance of WP_Post class.
 */
function gutenberg_disable_content_editor_for_navigation_post_type( $post ) {
	$post_type = get_post_type( $post );
	if ( 'wp_navigation' !== $post_type ) {
		return;
	}

	remove_post_type_support( $post_type, 'editor' );
}

add_action( 'edit_form_after_title', 'gutenberg_disable_content_editor_for_navigation_post_type', 10, 1 );

/**
 * This callback enables content editor for wp_navigation type posts.
 * We need to enable it back because we disable it to hide
 * the content editor for wp_navigation type posts.
 *
 * @see gutenberg_disable_content_editor_for_navigation_post_type
 *
 * @param WP_Post $post An instance of WP_Post class.
 */
function gutenberg_enable_content_editor_for_navigation_post_type( $post ) {
	$post_type = get_post_type( $post );
	if ( 'wp_navigation' !== $post_type ) {
		return;
	}

	add_post_type_support( $post_type, 'editor' );
}

add_action( 'edit_form_after_editor', 'gutenberg_enable_content_editor_for_navigation_post_type', 10, 1 );

/**
 * Rename the menu title from "All Navigation Menus" to "Navigation Menus".
 */
function gutenberg_rename_navigation_post_type_admin_menu_entry() {
	global $submenu;
	if ( ! isset( $submenu['themes.php'] ) ) {
		return;
	}

	$post_type = get_post_type_object( 'wp_navigation' );
	if ( ! $post_type ) {
		return;
	}

	$menu_title_index = 0;
	foreach ( $submenu['themes.php'] as $key => $menu_item ) {
		if ( $post_type->labels->all_items === $menu_item[ $menu_title_index ] ) {
			$submenu['themes.php'][ $key ][ $menu_title_index ] = $post_type->labels->menu_name; // phpcs:ignore WordPress.WP.GlobalVariablesOverride
			return;
		}
	}
}

add_action( 'admin_menu', 'gutenberg_rename_navigation_post_type_admin_menu_entry' );

// The functions below are copied over from packages/block-library/src/navigation/index.php
// Let's figure out a better way of managing these global PHP dependencies.

/**
 * Returns the menu items for a WordPress menu location.
 *
 * @param string $location The menu location.
 * @return array Menu items for the location.
 */
function gutenberg_get_menu_items_at_location( $location ) {
	if ( empty( $location ) ) {
		return;
	}

	// Build menu data. The following approximates the code in
	// `wp_nav_menu()` and `gutenberg_output_block_nav_menu`.

	// Find the location in the list of locations, returning early if the
	// location can't be found.
	$locations = get_nav_menu_locations();
	if ( ! isset( $locations[ $location ] ) ) {
		return;
	}

	// Get the menu from the location, returning early if there is no
	// menu or there was an error.
	$menu = wp_get_nav_menu_object( $locations[ $location ] );
	if ( ! $menu || is_wp_error( $menu ) ) {
		return;
	}

	$menu_items = wp_get_nav_menu_items( $menu->term_id, array( 'update_post_term_cache' => false ) );
	_wp_menu_item_classes_by_context( $menu_items );

	return $menu_items;
}


/**
 * Sorts a standard array of menu items into a nested structure keyed by the
 * id of the parent menu.
 *
 * @param array $menu_items Menu items to sort.
 * @return array An array keyed by the id of the parent menu where each element
 *               is an array of menu items that belong to that parent.
 */
function gutenberg_sort_menu_items_by_parent_id( $menu_items ) {
	$sorted_menu_items = array();
	foreach ( (array) $menu_items as $menu_item ) {
		$sorted_menu_items[ $menu_item->menu_order ] = $menu_item;
	}
	unset( $menu_items, $menu_item );

	$menu_items_by_parent_id = array();
	foreach ( $sorted_menu_items as $menu_item ) {
		$menu_items_by_parent_id[ $menu_item->menu_item_parent ][] = $menu_item;
	}

	return $menu_items_by_parent_id;
}

/**
 * Turns menu item data into a nested array of parsed blocks
 *
 * @param array $menu_items               An array of menu items that represent
 *                                        an individual level of a menu.
 * @param array $menu_items_by_parent_id  An array keyed by the id of the
 *                                        parent menu where each element is an
 *                                        array of menu items that belong to
 *                                        that parent.
 * @return array An array of parsed block data.
 */
function gutenberg_parse_blocks_from_menu_items( $menu_items, $menu_items_by_parent_id ) {
	if ( empty( $menu_items ) ) {
		return array();
	}

	$blocks = array();

	foreach ( $menu_items as $menu_item ) {
		$class_name       = ! empty( $menu_item->classes ) ? implode( ' ', (array) $menu_item->classes ) : null;
		$id               = ( null !== $menu_item->object_id && 'custom' !== $menu_item->object ) ? $menu_item->object_id : null;
		$opens_in_new_tab = null !== $menu_item->target && '_blank' === $menu_item->target;
		$rel              = ( null !== $menu_item->xfn && '' !== $menu_item->xfn ) ? $menu_item->xfn : null;
		$kind             = null !== $menu_item->type ? str_replace( '_', '-', $menu_item->type ) : 'custom';

		$block = array(
			'blockName' => isset( $menu_items_by_parent_id[ $menu_item->ID ] ) ? 'core/navigation-submenu' : 'core/navigation-link',
			'attrs'     => array(
				'className'     => $class_name,
				'description'   => $menu_item->description,
				'id'            => $id,
				'kind'          => $kind,
				'label'         => $menu_item->title,
				'opensInNewTab' => $opens_in_new_tab,
				'rel'           => $rel,
				'title'         => $menu_item->attr_title,
				'type'          => $menu_item->object,
				'url'           => $menu_item->url,
			),
		);

		$block['innerBlocks']  = isset( $menu_items_by_parent_id[ $menu_item->ID ] )
			? gutenberg_parse_blocks_from_menu_items( $menu_items_by_parent_id[ $menu_item->ID ], $menu_items_by_parent_id )
			: array();
		$block['innerContent'] = array_map( 'serialize_block', $block['innerBlocks'] );

		$blocks[] = $block;
	}

	return $blocks;
}

/**
 * Shim that hides ability to edit visibility and status for wp_navigation type posts.
 * When merged to Core, the CSS below should be moved to wp-admin/css/edit.css.
 *
 * This shim can be removed when the Gutenberg plugin requires a WordPress
 * version that has the ticket below.
 *
 * @see https://core.trac.wordpress.org/ticket/54407
 *
 * @param string $hook The current admin page.
 */
function gutenberg_hide_visibility_and_status_for_navigation_posts( $hook ) {
	$allowed_hooks = array( 'post.php', 'post-new.php' );
	if ( ! in_array( $hook, $allowed_hooks, true ) ) {
		return;
	}

	/**
	 * HACK: We're hiding the description field using CSS because this
	 * cannot be done using a filter or an action.
	 */

	$css = <<<CSS
			body.post-type-wp_navigation div#minor-publishing {
				display: none;
			}
CSS;

	wp_add_inline_style( 'common', $css );
}

add_action( 'admin_enqueue_scripts', 'gutenberg_hide_visibility_and_status_for_navigation_posts' );
