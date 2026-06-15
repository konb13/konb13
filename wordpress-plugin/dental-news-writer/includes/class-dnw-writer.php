<?php
/**
 * Generates a fresh, SEO/GEO-optimised dental article in the house voice,
 * inspired by (not copied from) a trending news item.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Writer
 */
class DNW_Writer {

	/**
	 * Tone library.
	 *
	 * @var array
	 */
	private static $tones = array(
		'professional'   => 'Professional and polished, suitable for a clinical yet approachable dental practice.',
		'casual'         => 'Casual and friendly, like a trusted hygienist chatting with a patient.',
		'educational'    => 'Clear and educational, defining clinical terms in plain language.',
		'conversational' => 'Warm and conversational, addressing the reader directly as "you".',
		'authoritative'  => 'Confident and authoritative, citing best practices and clinical standards.',
		'witty'          => 'Lightly witty and engaging while staying accurate and reassuring.',
	);

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
	 * Write an article.
	 *
	 * @param array  $item          News item (title, summary, link, source).
	 * @param string $voice_profile Voice/style profile text.
	 * @param string $trends        Optional Reddit/X trend context.
	 * @return array|WP_Error Article assoc array.
	 */
	public function write( $item, $voice_profile, $trends = '' ) {
		$api_key = trim( (string) ( $this->settings['openai_api_key'] ?? '' ) );
		if ( '' === $api_key ) {
			return new WP_Error( 'dnw_no_openai_key', __( 'OpenAI API key is required to write articles. Add it in settings.', 'dental-news-writer' ) );
		}

		$client = new DNW_OpenAI_Client( $api_key );

		$raw = $client->chat(
			array(
				array(
					'role'    => 'system',
					'content' => $this->system_prompt( $voice_profile ),
				),
				array(
					'role'    => 'user',
					'content' => $this->user_prompt( $item, $trends ),
				),
			),
			array(
				'model'       => $this->settings['openai_model'] ?? 'gpt-4o',
				'temperature' => 0.7,
				'max_tokens'  => 4096,
			)
		);

		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		$article = $this->parse( $raw, $item );
		$article['seo_score'] = DNW_Seo::score( $article );

		return $article;
	}

	/**
	 * Build the system prompt.
	 *
	 * @param string $voice_profile Voice profile.
	 * @return string
	 */
	private function system_prompt( $voice_profile ) {
		$tone_key   = $this->settings['tone'] ?? 'professional';
		$tone       = self::$tones[ $tone_key ] ?? self::$tones['professional'];
		$word_count = (int) ( $this->settings['word_count'] ?? 1400 );
		$low        = max( 400, $word_count - 200 );
		$high       = $word_count + 200;

		return implode(
			"\n",
			array(
				'You are the in-house content writer for a dental practice. You write original, accurate, patient-friendly articles that match the practice\'s established voice.',
				'',
				'VOICE & STYLE TO MATCH:',
				$voice_profile,
				'',
				'TONE: ' . $tone,
				'',
				'SEO + GEO REQUIREMENTS:',
				'- Output valid HTML only (no markdown code fences).',
				'- Begin with a single <h1> containing the focus keyword.',
				'- Immediately follow with a concise TL;DR <p> that directly answers the core question (for AI overviews / featured snippets).',
				'- Use the focus keyword naturally at roughly 1-1.5% density; include close variants.',
				'- At least four <h2> sections and two <h3> subsections.',
				'- Include at least one <ul> or <ol> list and, where useful, a <table>.',
				'- End with <h2>Frequently Asked Questions</h2> containing 3+ Q&A pairs (questions as <h3>).',
				sprintf( '- Target length: %d-%d words.', $low, $high ),
				'',
				'EDITORIAL RULES (medical safety):',
				'- This is general educational content, not medical advice. Include a brief line encouraging readers to consult their dentist for personal concerns.',
				'- Do NOT fabricate statistics, study results, or quotes. If a figure is needed, phrase it generally (e.g. "research suggests").',
				'- Write an ORIGINAL article inspired by the news angle. Do not copy or closely paraphrase the source. Do not present the source\'s claims as your own reporting.',
			)
		);
	}

	/**
	 * Build the user prompt from the news item.
	 *
	 * @param array  $item   News item.
	 * @param string $trends Optional Reddit/X trend context.
	 * @return string
	 */
	private function user_prompt( $item, $trends = '' ) {
		$country = $this->settings['country'] ?? 'US';
		$lang    = $this->settings['language'] ?? 'en';

		$context = 'Trending dental news angle to build an original article around:' . "\n";
		$context .= 'Headline: ' . $item['title'] . "\n";
		if ( ! empty( $item['summary'] ) ) {
			$context .= 'Summary: ' . $item['summary'] . "\n";
		}
		if ( ! empty( $item['source'] ) ) {
			$context .= 'Source: ' . $item['source'] . "\n";
		}

		$trend_block = '';
		if ( '' !== trim( (string) $trends ) ) {
			$trend_block = "\n" . $trends . "\n";
		}

		return implode(
			"\n",
			array(
				$context,
				$trend_block,
				'Audience country: ' . $country . ' | Language: ' . $lang,
				'',
				'Write a complete, original dental article on this theme for our practice blog.',
				'',
				'OUTPUT FORMAT:',
				'Line 1: a single-line JSON object (no line breaks inside) with keys: title, meta_description, focus_keyword, slug, excerpt, tags (array of 5-8), categories (array of 1-3).',
				'From line 2 onward: the full HTML article body.',
			)
		);
	}

	/**
	 * Parse the model response into an article array.
	 *
	 * @param string $raw  Raw model output.
	 * @param array  $item News item.
	 * @return array
	 */
	private function parse( $raw, $item ) {
		$raw   = trim( $raw );
		$lines = preg_split( '/\r\n|\r|\n/', $raw );
		$meta  = array();

		// Find the JSON object (usually first non-empty line).
		$json_line_index = -1;
		foreach ( $lines as $i => $line ) {
			if ( '' === trim( $line ) ) {
				continue;
			}
			if ( preg_match( '/\{.*\}/s', $line, $m ) ) {
				$decoded = json_decode( $m[0], true );
				if ( is_array( $decoded ) ) {
					$meta            = $decoded;
					$json_line_index = $i;
					break;
				}
			}
			break; // First content line wasn't JSON; stop looking.
		}

		if ( $json_line_index >= 0 ) {
			$html = trim( implode( "\n", array_slice( $lines, $json_line_index + 1 ) ) );
		} else {
			$html = $raw;
		}

		// Strip accidental code fences.
		$html = preg_replace( '/^```html\s*/i', '', $html );
		$html = preg_replace( '/```$/', '', trim( $html ) );

		$title          = $meta['title'] ?? $item['title'];
		$focus_keyword  = $meta['focus_keyword'] ?? $this->guess_keyword( $item['title'] );
		$slug           = $meta['slug'] ?? sanitize_title( $title );
		$meta_desc      = $meta['meta_description'] ?? '';
		$excerpt        = $meta['excerpt'] ?? $meta_desc;
		$tags           = isset( $meta['tags'] ) && is_array( $meta['tags'] ) ? $meta['tags'] : array();
		$categories     = isset( $meta['categories'] ) && is_array( $meta['categories'] ) ? $meta['categories'] : array();

		if ( '' === $meta_desc ) {
			$meta_desc = wp_trim_words( wp_strip_all_tags( $html ), 30 );
		}

		return array(
			'title'            => sanitize_text_field( $title ),
			'focus_keyword'    => sanitize_text_field( $focus_keyword ),
			'slug'             => sanitize_title( $slug ),
			'meta_description' => sanitize_text_field( $meta_desc ),
			'excerpt'          => sanitize_text_field( $excerpt ),
			'tags'             => array_map( 'sanitize_text_field', $tags ),
			'categories'       => array_map( 'sanitize_text_field', $categories ),
			'html'             => wp_kses_post( $html ),
			'source_link'      => $item['link'] ?? '',
		);
	}

	/**
	 * Naive focus keyword guess from a headline.
	 *
	 * @param string $title Headline.
	 * @return string
	 */
	private function guess_keyword( $title ) {
		$words = preg_split( '/\s+/', strtolower( wp_strip_all_tags( $title ) ) );
		$words = array_slice( array_filter( $words ), 0, 4 );
		return implode( ' ', $words );
	}
}
