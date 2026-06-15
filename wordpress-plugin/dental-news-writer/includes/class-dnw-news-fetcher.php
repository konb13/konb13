<?php
/**
 * Fetches trending dental news from configured RSS/Atom feeds.
 *
 * Uses WordPress' built-in SimplePie (fetch_feed) so no extra dependency is
 * required. Items are keyword-filtered to keep them dental-relevant and
 * de-duplicated against previously processed GUIDs.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_News_Fetcher
 */
class DNW_News_Fetcher {

	const PROCESSED_OPTION = 'dnw_processed_guids';
	const PROCESSED_MAX    = 500;

	/**
	 * Plugin settings.
	 *
	 * @var array
	 */
	private $settings;

	/**
	 * Constructor.
	 *
	 * @param array $settings Settings array.
	 */
	public function __construct( $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Fetch up to $limit fresh, dental-relevant, unprocessed news items.
	 *
	 * Returns newest/most relevant first.
	 *
	 * @param int $limit Max items to return.
	 * @return array|WP_Error
	 */
	public function fetch_new( $limit = 1 ) {
		$feeds = DNW_Settings::feed_list();
		if ( empty( $feeds ) ) {
			return new WP_Error( 'dnw_no_feeds', __( 'No news feeds configured. Add at least one RSS feed URL in settings.', 'dental-news-writer' ) );
		}

		if ( ! function_exists( 'fetch_feed' ) ) {
			require_once ABSPATH . WPINC . '/feed.php';
		}

		$keywords  = $this->keyword_list();
		$processed = self::processed_guids();
		$candidates = array();

		foreach ( $feeds as $feed_url ) {
			$feed = fetch_feed( $feed_url );
			if ( is_wp_error( $feed ) ) {
				continue; // Skip a broken feed, keep going.
			}
			$max   = $feed->get_item_quantity( 25 );
			$items = $feed->get_items( 0, $max );

			foreach ( $items as $sp_item ) {
				$title   = trim( wp_strip_all_tags( (string) $sp_item->get_title() ) );
				$summary = trim( wp_strip_all_tags( (string) $sp_item->get_description() ) );
				$link    = esc_url_raw( (string) $sp_item->get_permalink() );
				$guid    = (string) $sp_item->get_id();
				if ( '' === $guid ) {
					$guid = md5( $title . $link );
				}

				if ( '' === $title || in_array( $guid, $processed, true ) ) {
					continue;
				}

				$haystack = strtolower( $title . ' ' . $summary );
				if ( ! $this->matches_keywords( $haystack, $keywords ) ) {
					continue;
				}

				$date = $sp_item->get_date( 'U' );
				$candidates[] = array(
					'title'   => $title,
					'summary' => mb_substr( $summary, 0, 1200 ),
					'link'    => $link,
					'source'  => wp_parse_url( $feed_url, PHP_URL_HOST ),
					'guid'    => $guid,
					'date'    => $date ? (int) $date : 0,
				);
			}
		}

		if ( empty( $candidates ) ) {
			return array();
		}

		// Newest first.
		usort(
			$candidates,
			function ( $a, $b ) {
				return $b['date'] <=> $a['date'];
			}
		);

		return array_slice( $candidates, 0, max( 1, (int) $limit ) );
	}

	/**
	 * Whether the haystack contains at least one keyword (or no filter set).
	 *
	 * @param string $haystack Lowercased text.
	 * @param array  $keywords Keyword list.
	 * @return bool
	 */
	private function matches_keywords( $haystack, $keywords ) {
		if ( empty( $keywords ) ) {
			return true;
		}
		foreach ( $keywords as $kw ) {
			if ( '' !== $kw && false !== strpos( $haystack, $kw ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Parse the keyword filter setting into a lowercased array.
	 *
	 * @return array
	 */
	private function keyword_list() {
		$raw = isset( $this->settings['keyword_filter'] ) ? $this->settings['keyword_filter'] : '';
		$arr = array_filter( array_map( 'trim', explode( ',', strtolower( $raw ) ) ) );
		return array_values( $arr );
	}

	/**
	 * Get the list of already-processed GUIDs.
	 *
	 * @return array
	 */
	public static function processed_guids() {
		$g = get_option( self::PROCESSED_OPTION, array() );
		return is_array( $g ) ? $g : array();
	}

	/**
	 * Record a GUID as processed (capped ring buffer).
	 *
	 * @param string $guid Item GUID.
	 */
	public static function mark_processed( $guid ) {
		$g = self::processed_guids();
		array_unshift( $g, $guid );
		$g = array_values( array_unique( $g ) );
		if ( count( $g ) > self::PROCESSED_MAX ) {
			$g = array_slice( $g, 0, self::PROCESSED_MAX );
		}
		update_option( self::PROCESSED_OPTION, $g, false );
	}

	/**
	 * Preview a batch of candidate items without marking them processed.
	 *
	 * @param int $limit Max items.
	 * @return array|WP_Error
	 */
	public function preview( $limit = 10 ) {
		return $this->fetch_new( $limit );
	}
}
