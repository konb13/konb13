<?php
/**
 * Social trend research aggregator (Reddit + X/Twitter).
 *
 * Gathers real-world discussion around a topic so the writer can ground the
 * article in genuine angles, questions, and terminology people use.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Research
 */
class DNW_Research {

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
	 * Gather trend posts for a query from enabled sources.
	 *
	 * @param string $query Topic/headline to research.
	 * @return array[] Normalised posts sorted by score.
	 */
	public function gather( $query ) {
		if ( empty( $this->settings['research_social'] ) ) {
			return array();
		}

		$query = trim( wp_strip_all_tags( $query ) );
		if ( '' === $query ) {
			return array();
		}

		$limit = (int) ( $this->settings['research_limit'] ?? 12 );
		$posts = array();

		// Reddit (no key required).
		$reddit = new DNW_Reddit_Client( $this->settings['reddit_user_agent'] ?? '' );
		$posts  = array_merge( $posts, $reddit->search( $query, $limit ) );

		// X / Twitter (needs bearer token).
		$bearer = $this->settings['twitter_bearer_token'] ?? '';
		if ( '' !== trim( (string) $bearer ) ) {
			$twitter = new DNW_Twitter_Client( $bearer );
			$posts   = array_merge( $posts, $twitter->search( $query, $limit ) );
		}

		usort(
			$posts,
			function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);

		return $posts;
	}

	/**
	 * Build a compact text summary of trend posts for the writer prompt.
	 *
	 * @param array  $posts Trend posts.
	 * @param string $query Original query.
	 * @return string
	 */
	public function summarize( $posts, $query ) {
		if ( empty( $posts ) ) {
			return '';
		}

		$lines = array( 'Real discussion trending around "' . $query . '" (use these angles, questions and terms naturally; do not quote verbatim):' );
		$count = 0;
		foreach ( $posts as $p ) {
			if ( $count >= 15 ) {
				break;
			}
			$src  = strtoupper( $p['source'] );
			$line = sprintf( '[%s] %s', $src, $p['title'] );
			if ( ! empty( $p['subreddit'] ) ) {
				$line .= ' (r/' . $p['subreddit'] . ')';
			}
			$lines[] = $line;
			$count++;
		}

		return implode( "\n", $lines );
	}

	/**
	 * Convenience: gather + summarize in one call.
	 *
	 * @param string $query Topic/headline.
	 * @return string Summary text (empty when disabled or nothing found).
	 */
	public function context_for( $query ) {
		return $this->summarize( $this->gather( $query ), $query );
	}
}
