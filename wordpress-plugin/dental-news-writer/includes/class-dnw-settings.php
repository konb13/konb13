<?php
/**
 * Settings storage, defaults, and registration.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Settings
 */
class DNW_Settings {

	/**
	 * Return the merged settings (saved over defaults).
	 *
	 * @return array
	 */
	public static function get() {
		$saved = get_option( DNW_OPTION_KEY, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return wp_parse_args( $saved, self::defaults() );
	}

	/**
	 * Get a single setting value.
	 *
	 * @param string $key     Setting key.
	 * @param mixed  $default Fallback.
	 * @return mixed
	 */
	public static function get_value( $key, $default = null ) {
		$all = self::get();
		return isset( $all[ $key ] ) ? $all[ $key ] : $default;
	}

	/**
	 * Default settings.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			// API credentials.
			'openai_api_key'     => '',
			'openai_model'       => 'gpt-4o',
			'higgsfield_api_key' => '',
			'higgsfield_secret'  => '',
			'higgsfield_endpoint'=> 'https://platform.higgsfield.ai/v1/image/generate',

			// News sources (one RSS feed URL per line).
			'feeds'              => implode(
				"\n",
				array(
					'https://www.dentistrytoday.com/feed/',
					'https://www.dentistryiq.com/rss.xml',
					'https://www.dental-tribune.com/feed/',
					'https://www.ada.org/about/press-releases/rss',
				)
			),
			'keyword_filter'     => 'dental, dentist, dentistry, oral health, orthodont, implant, hygiene, teeth',

			// Article generation.
			'tone'               => 'professional',
			'word_count'         => 1400,
			'language'           => 'en',
			'country'            => 'US',
			'image_provider'     => 'higgsfield', // higgsfield | dalle (with auto-fallback higgsfield->dalle).

			// Writer voice.
			'voice_learn'        => 1,            // Learn from existing published posts.
			'voice_sample_count' => 8,            // How many recent posts to analyse.
			'voice_post_type'    => 'post',
			'voice_style_guide'  => '',           // Manual style guide / sample text override.

			// Publishing.
			'post_status'        => 'draft',      // draft | pending | publish.
			'post_category'      => 0,            // Term ID; 0 = uncategorised/default.
			'post_author'        => 0,            // User ID; 0 = current/admin.

			// Scheduling.
			'schedule'           => 'disabled',   // disabled | hourly | twicedaily | daily | weekly.
			'posts_per_run'      => 1,
		);
	}

	/**
	 * Seed defaults on activation if no settings exist yet.
	 */
	public static function set_defaults() {
		if ( false === get_option( DNW_OPTION_KEY, false ) ) {
			add_option( DNW_OPTION_KEY, self::defaults() );
		}
	}

	/**
	 * Register the WordPress setting + sanitisation callback.
	 */
	public static function register() {
		register_setting(
			'dnw_settings_group',
			DNW_OPTION_KEY,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => self::defaults(),
			)
		);
	}

	/**
	 * Sanitise submitted settings.
	 *
	 * @param array $input Raw input.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$out      = self::get(); // Start from current so untouched keys persist.
		$defaults = self::defaults();

		$text_keys = array(
			'openai_api_key',
			'higgsfield_api_key',
			'higgsfield_secret',
		);
		foreach ( $text_keys as $k ) {
			if ( isset( $input[ $k ] ) ) {
				$out[ $k ] = sanitize_text_field( trim( $input[ $k ] ) );
			}
		}

		if ( isset( $input['openai_model'] ) ) {
			$out['openai_model'] = sanitize_text_field( $input['openai_model'] );
		}
		if ( isset( $input['higgsfield_endpoint'] ) ) {
			$out['higgsfield_endpoint'] = esc_url_raw( trim( $input['higgsfield_endpoint'] ) );
		}

		if ( isset( $input['feeds'] ) ) {
			$out['feeds'] = self::sanitize_feeds( $input['feeds'] );
		}
		if ( isset( $input['keyword_filter'] ) ) {
			$out['keyword_filter'] = sanitize_text_field( $input['keyword_filter'] );
		}

		$allowed_tones = array( 'professional', 'casual', 'educational', 'conversational', 'authoritative', 'witty' );
		if ( isset( $input['tone'] ) && in_array( $input['tone'], $allowed_tones, true ) ) {
			$out['tone'] = $input['tone'];
		}

		$out['word_count']         = isset( $input['word_count'] ) ? max( 400, min( 4000, absint( $input['word_count'] ) ) ) : $out['word_count'];
		$out['language']           = isset( $input['language'] ) ? sanitize_text_field( $input['language'] ) : $out['language'];
		$out['country']            = isset( $input['country'] ) ? sanitize_text_field( $input['country'] ) : $out['country'];

		$allowed_img = array( 'higgsfield', 'dalle' );
		if ( isset( $input['image_provider'] ) && in_array( $input['image_provider'], $allowed_img, true ) ) {
			$out['image_provider'] = $input['image_provider'];
		}

		$out['voice_learn']        = empty( $input['voice_learn'] ) ? 0 : 1;
		$out['voice_sample_count'] = isset( $input['voice_sample_count'] ) ? max( 1, min( 30, absint( $input['voice_sample_count'] ) ) ) : $out['voice_sample_count'];
		$out['voice_post_type']    = isset( $input['voice_post_type'] ) ? sanitize_key( $input['voice_post_type'] ) : $out['voice_post_type'];
		$out['voice_style_guide']  = isset( $input['voice_style_guide'] ) ? sanitize_textarea_field( $input['voice_style_guide'] ) : $out['voice_style_guide'];

		$allowed_status = array( 'draft', 'pending', 'publish' );
		if ( isset( $input['post_status'] ) && in_array( $input['post_status'], $allowed_status, true ) ) {
			$out['post_status'] = $input['post_status'];
		}
		$out['post_category'] = isset( $input['post_category'] ) ? absint( $input['post_category'] ) : $out['post_category'];
		$out['post_author']   = isset( $input['post_author'] ) ? absint( $input['post_author'] ) : $out['post_author'];

		$allowed_sched = array( 'disabled', 'hourly', 'twicedaily', 'daily', 'dnw_weekly' );
		if ( isset( $input['schedule'] ) && in_array( $input['schedule'], $allowed_sched, true ) ) {
			$out['schedule'] = $input['schedule'];
		}
		$out['posts_per_run'] = isset( $input['posts_per_run'] ) ? max( 1, min( 10, absint( $input['posts_per_run'] ) ) ) : $out['posts_per_run'];

		// Re-arm cron whenever schedule may have changed.
		if ( class_exists( 'DNW_Cron' ) ) {
			// Persist first so reschedule reads new value.
			update_option( DNW_OPTION_KEY, $out );
			DNW_Cron::reschedule( $out['schedule'] );
		}

		return $out;
	}

	/**
	 * Clean a newline-separated list of feed URLs.
	 *
	 * @param string $raw Raw textarea content.
	 * @return string
	 */
	public static function sanitize_feeds( $raw ) {
		$lines = preg_split( '/[\r\n]+/', (string) $raw );
		$clean = array();
		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}
			$url = esc_url_raw( $line );
			if ( $url ) {
				$clean[] = $url;
			}
		}
		return implode( "\n", array_unique( $clean ) );
	}

	/**
	 * Get feeds as an array.
	 *
	 * @return string[]
	 */
	public static function feed_list() {
		$raw = self::get_value( 'feeds', '' );
		$arr = preg_split( '/[\r\n]+/', (string) $raw, -1, PREG_SPLIT_NO_EMPTY );
		return array_map( 'trim', $arr );
	}
}
