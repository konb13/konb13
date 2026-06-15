<?php
/**
 * Builds a "writer voice" profile so generated articles match your team's style.
 *
 * Combines two sources (per user choice):
 *   1. Auto-learned profile from your recently published posts.
 *   2. A manual style guide / sample text entered in settings.
 *
 * The learned profile is cached as a transient to avoid re-analysing on every run.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Voice_Analyzer
 */
class DNW_Voice_Analyzer {

	const CACHE_KEY = 'dnw_voice_profile';
	const CACHE_TTL = DAY_IN_SECONDS;

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
	 * Get the combined voice profile string fed to the writer.
	 *
	 * @param bool $force_refresh Bypass cache for the learned part.
	 * @return string
	 */
	public function get_profile( $force_refresh = false ) {
		$parts = array();

		if ( ! empty( $this->settings['voice_learn'] ) ) {
			$learned = $this->learned_profile( $force_refresh );
			if ( $learned ) {
				$parts[] = "LEARNED HOUSE STYLE (derived from your published articles):\n" . $learned;
			}
		}

		$manual = trim( (string) ( $this->settings['voice_style_guide'] ?? '' ) );
		if ( '' !== $manual ) {
			$parts[] = "EDITOR-SUPPLIED STYLE GUIDE (highest priority — follow this closely):\n" . $manual;
		}

		if ( empty( $parts ) ) {
			return 'No custom voice profile provided. Use a clear, trustworthy, patient-friendly dental-practice tone.';
		}

		return implode( "\n\n", $parts );
	}

	/**
	 * Get (and cache) a learned style description from existing posts.
	 *
	 * @param bool $force_refresh Bypass cache.
	 * @return string
	 */
	public function learned_profile( $force_refresh = false ) {
		if ( ! $force_refresh ) {
			$cached = get_transient( self::CACHE_KEY );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$samples = $this->collect_samples();
		if ( '' === $samples ) {
			return '';
		}

		$profile = $this->summarise_style( $samples );
		set_transient( self::CACHE_KEY, $profile, self::CACHE_TTL );
		return $profile;
	}

	/**
	 * Pull text from the most recent published posts.
	 *
	 * @return string
	 */
	private function collect_samples() {
		$count     = (int) ( $this->settings['voice_sample_count'] ?? 8 );
		$post_type = $this->settings['voice_post_type'] ?? 'post';

		$query = new WP_Query(
			array(
				'post_type'           => $post_type,
				'post_status'         => 'publish',
				'posts_per_page'      => $count,
				'orderby'             => 'date',
				'order'               => 'DESC',
				'ignore_sticky_posts' => true,
				'no_found_rows'       => true,
			)
		);

		$chunks = array();
		foreach ( $query->posts as $post ) {
			$text = wp_strip_all_tags( $post->post_content );
			$text = preg_replace( '/\s+/', ' ', $text );
			$text = trim( $text );
			if ( '' === $text ) {
				continue;
			}
			$chunks[] = '— "' . $post->post_title . '": ' . mb_substr( $text, 0, 900 );
		}
		wp_reset_postdata();

		return implode( "\n\n", $chunks );
	}

	/**
	 * Summarise the samples into a reusable style description.
	 *
	 * Uses OpenAI when a key is available; otherwise falls back to a heuristic
	 * description plus a trimmed excerpt of the samples.
	 *
	 * @param string $samples Raw concatenated post text.
	 * @return string
	 */
	private function summarise_style( $samples ) {
		$api_key = trim( (string) ( $this->settings['openai_api_key'] ?? '' ) );

		if ( '' === $api_key ) {
			// Heuristic fallback: hand the model raw excerpts to imitate.
			return "Imitate the following sample excerpts' vocabulary, sentence length, "
				. "and rhythm:\n" . mb_substr( $samples, 0, 2500 );
		}

		$client = new DNW_OpenAI_Client( $api_key );
		$prompt = "Analyse the following article excerpts from a dental practice's blog. "
			. "Describe their house writing style in a concise, reusable brief (max 250 words): "
			. "tone, formality, sentence length, use of jargon vs plain language, how they address "
			. "the reader, typical structure, and any signature phrasing. Output only the style brief.\n\n"
			. $samples;

		$result = $client->chat(
			array(
				array(
					'role'    => 'system',
					'content' => 'You are an editorial analyst who distils writing style into actionable briefs.',
				),
				array(
					'role'    => 'user',
					'content' => $prompt,
				),
			),
			array(
				'model'       => $this->settings['openai_model'] ?? 'gpt-4o',
				'temperature' => 0.3,
				'max_tokens'  => 600,
			)
		);

		if ( is_wp_error( $result ) || '' === trim( (string) $result ) ) {
			return "Imitate the following sample excerpts' vocabulary and rhythm:\n" . mb_substr( $samples, 0, 2500 );
		}

		return trim( $result );
	}

	/**
	 * Clear the cached learned profile.
	 */
	public static function flush_cache() {
		delete_transient( self::CACHE_KEY );
	}
}
