<?php
/**
 * Reddit trend client (WordPress HTTP API).
 *
 * Uses Reddit's public JSON search endpoint (no OAuth needed for modest,
 * read-only volume) with a descriptive User-Agent. Returns trending posts to
 * give the writer real-world context and angles.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Reddit_Client
 */
class DNW_Reddit_Client {

	/**
	 * User agent string.
	 *
	 * @var string
	 */
	private $user_agent;

	/**
	 * Constructor.
	 *
	 * @param string $user_agent Optional UA override.
	 */
	public function __construct( $user_agent = '' ) {
		$this->user_agent = $user_agent ? $user_agent : 'DentalNewsWriter/1.0 (WordPress plugin)';
	}

	/**
	 * Search Reddit for a query and return normalised trend posts.
	 *
	 * @param string $query Search query.
	 * @param int    $limit Max posts.
	 * @return array[] Each: source, title, body, score, url, subreddit.
	 */
	public function search( $query, $limit = 12 ) {
		$url = add_query_arg(
			array(
				'q'     => $query,
				'sort'  => 'hot',
				't'     => 'week',
				'limit' => max( 1, min( 25, (int) $limit ) ),
			),
			'https://www.reddit.com/search.json'
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 25,
				'headers' => array(
					'User-Agent' => $this->user_agent,
					'Accept'     => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array();
		}
		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		$children = isset( $data['data']['children'] ) ? $data['data']['children'] : array();

		$posts = array();
		foreach ( $children as $child ) {
			$d = isset( $child['data'] ) ? $child['data'] : array();
			if ( empty( $d['title'] ) ) {
				continue;
			}
			$body = '';
			if ( ! empty( $d['selftext'] ) ) {
				$body = mb_substr( wp_strip_all_tags( $d['selftext'] ), 0, 400 );
			}
			$posts[] = array(
				'source'    => 'reddit',
				'title'     => wp_strip_all_tags( $d['title'] ),
				'body'      => $body,
				'score'     => isset( $d['score'] ) ? (int) $d['score'] : 0,
				'url'       => isset( $d['permalink'] ) ? 'https://reddit.com' . $d['permalink'] : '',
				'subreddit' => isset( $d['subreddit'] ) ? $d['subreddit'] : '',
			);
		}

		usort(
			$posts,
			function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);

		return array_slice( $posts, 0, $limit );
	}
}
