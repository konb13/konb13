<?php
/**
 * Creates the WordPress post from a generated article and applies taxonomy + SEO.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Publisher
 */
class DNW_Publisher {

	/**
	 * Settings.
	 *
	 * @var array
	 */
	private $settings;

	/**
	 * Constructor.
	 *
	 * @param array $settings Settings.
	 */
	public function __construct( $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Insert the post (default: draft) and apply taxonomy + SEO meta.
	 *
	 * @param array $article Article array.
	 * @param array $item    Source news item.
	 * @return int|WP_Error Post ID.
	 */
	public function create_draft( $article, $item ) {
		$status = $this->settings['post_status'] ?? 'draft';
		$author = (int) ( $this->settings['post_author'] ?? 0 );
		if ( ! $author ) {
			$author = get_current_user_id();
		}
		if ( ! $author ) {
			// Cron context: fall back to first admin.
			$admins = get_users(
				array(
					'role'    => 'administrator',
					'number'  => 1,
					'fields'  => 'ID',
				)
			);
			$author = ! empty( $admins ) ? (int) $admins[0] : 1;
		}

		$postarr = array(
			'post_title'   => $article['title'],
			'post_content' => $article['html'],
			'post_excerpt' => $article['excerpt'] ?? '',
			'post_status'  => $status,
			'post_type'    => 'post',
			'post_author'  => $author,
			'post_name'    => $article['slug'],
		);

		$post_id = wp_insert_post( $postarr, true );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		// Categories.
		$cat_ids = $this->resolve_categories( $article['categories'] ?? array() );
		if ( ! empty( $cat_ids ) ) {
			wp_set_post_categories( $post_id, $cat_ids );
		}

		// Tags.
		if ( ! empty( $article['tags'] ) ) {
			wp_set_post_tags( $post_id, $article['tags'], false );
		}

		// SEO meta.
		DNW_Seo::apply_meta( $post_id, $article );

		// Provenance meta for transparency / auditing.
		update_post_meta( $post_id, '_dnw_generated', 1 );
		update_post_meta( $post_id, '_dnw_source_title', $item['title'] ?? '' );
		update_post_meta( $post_id, '_dnw_source_link', $item['link'] ?? '' );
		update_post_meta( $post_id, '_dnw_generated_at', current_time( 'mysql' ) );

		return $post_id;
	}

	/**
	 * Map category names to term IDs, creating them if needed.
	 *
	 * Always includes the configured default category if set.
	 *
	 * @param array $names Category names from the model.
	 * @return int[]
	 */
	private function resolve_categories( $names ) {
		$ids = array();

		$default_cat = (int) ( $this->settings['post_category'] ?? 0 );
		if ( $default_cat > 0 ) {
			$ids[] = $default_cat;
		}

		foreach ( $names as $name ) {
			$name = trim( $name );
			if ( '' === $name ) {
				continue;
			}
			$term = get_term_by( 'name', $name, 'category' );
			if ( $term ) {
				$ids[] = (int) $term->term_id;
				continue;
			}
			$created = wp_insert_term( $name, 'category' );
			if ( ! is_wp_error( $created ) ) {
				$ids[] = (int) $created['term_id'];
			}
		}

		return array_values( array_unique( $ids ) );
	}
}
