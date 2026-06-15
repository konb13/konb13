<?php
/**
 * Main plugin orchestrator.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Plugin
 *
 * Wires together admin UI, settings, cron, and the generation pipeline.
 */
class DNW_Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var DNW_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Admin controller.
	 *
	 * @var DNW_Admin
	 */
	public $admin;

	/**
	 * Get the singleton instance.
	 *
	 * @return DNW_Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor – register hooks.
	 */
	private function __construct() {
		load_plugin_textdomain( 'dental-news-writer', false, dirname( plugin_basename( DNW_PLUGIN_FILE ) ) . '/languages' );

		// Admin UI + settings.
		if ( is_admin() ) {
			$this->admin = new DNW_Admin();
			$this->admin->init();
		}

		// Cron handler runs on front and back end.
		add_action( DNW_CRON_HOOK, array( 'DNW_Cron', 'run' ) );

		// Custom cron schedules.
		add_filter( 'cron_schedules', array( 'DNW_Cron', 'register_schedules' ) );
	}

	/**
	 * Run the end-to-end generation pipeline for a single item.
	 *
	 * @param array $args {
	 *     Optional overrides.
	 *
	 *     @type string $topic        Force a specific topic/headline instead of fetched news.
	 *     @type array  $source_item  A news item array (title, summary, link, source).
	 * }
	 * @return array|WP_Error Result with post_id on success.
	 */
	public static function generate_one( $args = array() ) {
		$settings = DNW_Settings::get();
		$logger   = new DNW_Logger();

		// 1. Determine the source news item.
		if ( ! empty( $args['source_item'] ) ) {
			$item = $args['source_item'];
		} elseif ( ! empty( $args['topic'] ) ) {
			$item = array(
				'title'   => $args['topic'],
				'summary' => '',
				'link'    => '',
				'source'  => 'manual',
				'guid'    => 'manual-' . md5( $args['topic'] . time() ),
			);
		} else {
			$fetcher = new DNW_News_Fetcher( $settings );
			$items   = $fetcher->fetch_new( 1 );
			if ( is_wp_error( $items ) ) {
				return $items;
			}
			if ( empty( $items ) ) {
				return new WP_Error( 'dnw_no_news', __( 'No new trending dental news found right now.', 'dental-news-writer' ) );
			}
			$item = $items[0];
		}

		$logger->log( sprintf( 'Generating article from: %s', $item['title'] ) );

		// 2. Build the writer voice profile.
		$voice    = new DNW_Voice_Analyzer( $settings );
		$voice_profile = $voice->get_profile();

		// 2b. Gather Reddit/X trend context (optional, best-effort).
		$trends = '';
		if ( ! empty( $settings['research_social'] ) ) {
			$research = new DNW_Research( $settings );
			$trends   = $research->context_for( $item['title'] );
			if ( '' !== $trends ) {
				$logger->log( 'Added Reddit/X trend context.' );
			}
		}

		// 3. Write the article.
		$writer  = new DNW_Writer( $settings );
		$article = $writer->write( $item, $voice_profile, $trends );
		if ( is_wp_error( $article ) ) {
			$logger->log( 'Writer error: ' . $article->get_error_message(), 'error' );
			return $article;
		}

		// 4. Create the draft post (so we have an ID for the image).
		$publisher = new DNW_Publisher( $settings );
		$post_id   = $publisher->create_draft( $article, $item );
		if ( is_wp_error( $post_id ) ) {
			$logger->log( 'Publish error: ' . $post_id->get_error_message(), 'error' );
			return $post_id;
		}

		// 5. Generate + attach featured image (best-effort, never fatal).
		$image_gen = new DNW_Image_Generator( $settings );
		$attach_id = $image_gen->generate_and_attach( $article, $post_id );
		if ( is_wp_error( $attach_id ) ) {
			$logger->log( 'Image error (non-fatal): ' . $attach_id->get_error_message(), 'warning' );
		} else {
			set_post_thumbnail( $post_id, $attach_id );
		}

		// 6. Mark this news item as processed.
		if ( ! empty( $item['guid'] ) ) {
			DNW_News_Fetcher::mark_processed( $item['guid'] );
		}

		$logger->log( sprintf( 'Created draft #%d: %s', $post_id, $article['title'] ), 'success' );

		return array(
			'post_id'   => $post_id,
			'title'     => $article['title'],
			'edit_link' => get_edit_post_link( $post_id, 'raw' ),
			'seo_score' => isset( $article['seo_score'] ) ? $article['seo_score'] : null,
			'image_id'  => is_wp_error( $attach_id ) ? 0 : $attach_id,
		);
	}
}
