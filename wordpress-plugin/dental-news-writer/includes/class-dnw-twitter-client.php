<?php
/**
 * X / Twitter trend client (WordPress HTTP API).
 *
 * Uses the v2 recent-search endpoint. Requires a Bearer token; without one the
 * client simply returns no results so research degrades gracefully.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Twitter_Client
 */
class DNW_Twitter_Client {

	/**
	 * Bearer token.
	 *
	 * @var string
	 */
	private $bearer;

	/**
	 * Constructor.
	 *
	 * @param string $bearer Bearer token.
	 */
	public function __construct( $bearer ) {
		$this->bearer = trim( (string) $bearer );
	}

	/**
	 * Search recent tweets and return normalised trend posts.
	 *
	 * @param string $query Search query.
	 * @param int    $limit Max posts (10-100).
	 * @return array[] Each: source, title, body, score, url.
	 */
	public function search( $query, $limit = 12 ) {
		if ( '' === $this->bearer ) {
			return array();
		}

		$max = max( 10, min( 100, (int) $limit ) );
		$url = add_query_arg(
			array(
				'query'        => rawurlencode( $query . ' -is:retweet lang:en' ),
				'max_results'  => $max,
				'tweet.fields' => 'public_metrics',
			),
			'https://api.twitter.com/2/tweets/search/recent'
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 25,
				'headers' => array(
					'Authorization' => 'Bearer ' . $this->bearer,
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array();
		}
		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			// 403/429 on free tier — skip silently.
			return array();
		}

		$data   = json_decode( wp_remote_retrieve_body( $response ), true );
		$tweets = isset( $data['data'] ) ? $data['data'] : array();

		$posts = array();
		foreach ( $tweets as $tweet ) {
			$text = isset( $tweet['text'] ) ? wp_strip_all_tags( $tweet['text'] ) : '';
			if ( '' === $text ) {
				continue;
			}
			$m     = isset( $tweet['public_metrics'] ) ? $tweet['public_metrics'] : array();
			$score = ( isset( $m['like_count'] ) ? (int) $m['like_count'] : 0 )
				+ ( isset( $m['retweet_count'] ) ? (int) $m['retweet_count'] * 2 : 0 )
				+ ( isset( $m['reply_count'] ) ? (int) $m['reply_count'] : 0 );

			$posts[] = array(
				'source' => 'twitter',
				'title'  => mb_substr( $text, 0, 120 ),
				'body'   => $text,
				'score'  => $score,
				'url'    => isset( $tweet['id'] ) ? 'https://x.com/i/web/status/' . $tweet['id'] : '',
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
