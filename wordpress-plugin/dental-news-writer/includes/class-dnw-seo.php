<?php
/**
 * SEO helpers: on-page score, and writing SEO meta to the active SEO plugin
 * (Yoast or Rank Math) or to plugin-native post meta as a fallback.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Seo
 */
class DNW_Seo {

	/**
	 * Compute a simple 0-100 on-page SEO score for an article array.
	 *
	 * @param array $article Article (title, focus_keyword, meta_description, slug, html).
	 * @return array { score:int, checks:array<string,bool>, notes:array }
	 */
	public static function score( $article ) {
		$kw        = strtolower( $article['focus_keyword'] ?? '' );
		$title     = strtolower( $article['title'] ?? '' );
		$slug      = strtolower( $article['slug'] ?? '' );
		$meta      = strtolower( $article['meta_description'] ?? '' );
		$html      = $article['html'] ?? '';
		$text      = strtolower( wp_strip_all_tags( $html ) );
		$word_count = str_word_count( $text );

		$checks = array();
		$notes  = array();

		// Keyword in title.
		$checks['kw_in_title'] = ( '' !== $kw && false !== strpos( $title, $kw ) );

		// Keyword in slug.
		$kw_slug               = sanitize_title( $kw );
		$checks['kw_in_slug']  = ( '' !== $kw_slug && false !== strpos( $slug, $kw_slug ) );

		// Keyword in meta description.
		$checks['kw_in_meta']  = ( '' !== $kw && false !== strpos( $meta, $kw ) );

		// Meta description length 120-160.
		$meta_len              = strlen( $article['meta_description'] ?? '' );
		$checks['meta_length'] = ( $meta_len >= 120 && $meta_len <= 160 );
		if ( ! $checks['meta_length'] ) {
			$notes[] = sprintf( 'Meta description is %d chars (aim for 120-160).', $meta_len );
		}

		// Keyword in first paragraph.
		$first_para            = '';
		if ( preg_match( '/<p[^>]*>(.*?)<\/p>/is', $html, $m ) ) {
			$first_para = strtolower( wp_strip_all_tags( $m[1] ) );
		}
		$checks['kw_in_intro'] = ( '' !== $kw && false !== strpos( $first_para, $kw ) );

		// Has H1.
		$checks['has_h1']      = (bool) preg_match( '/<h1[^>]*>/i', $html );

		// Has multiple H2.
		$h2_count              = preg_match_all( '/<h2[^>]*>/i', $html );
		$checks['enough_h2']   = ( $h2_count >= 3 );

		// Has a list.
		$checks['has_list']    = (bool) preg_match( '/<(ul|ol)[^>]*>/i', $html );

		// Word count >= 800.
		$checks['length_ok']   = ( $word_count >= 800 );
		if ( ! $checks['length_ok'] ) {
			$notes[] = sprintf( 'Article is %d words (aim for 800+).', $word_count );
		}

		// Keyword density 0.5%-2.5%.
		$kw_count = ( '' !== $kw && $word_count > 0 ) ? substr_count( $text, $kw ) : 0;
		$density  = $word_count > 0 ? ( $kw_count / $word_count ) * 100 : 0;
		$checks['density_ok'] = ( $density >= 0.5 && $density <= 2.5 );
		if ( ! $checks['density_ok'] ) {
			$notes[] = sprintf( 'Keyword density is %.2f%% (aim for 0.5-2.5%%).', $density );
		}

		// Has FAQ section.
		$checks['has_faq'] = ( false !== strpos( $text, 'frequently asked questions' ) );

		$passed = count( array_filter( $checks ) );
		$total  = count( $checks );
		$score  = $total > 0 ? (int) round( ( $passed / $total ) * 100 ) : 0;

		return array(
			'score'      => $score,
			'checks'     => $checks,
			'notes'      => $notes,
			'word_count' => $word_count,
			'density'    => round( $density, 2 ),
		);
	}

	/**
	 * Write SEO meta fields to whichever SEO plugin is active.
	 *
	 * @param int   $post_id Post ID.
	 * @param array $article Article array.
	 */
	public static function apply_meta( $post_id, $article ) {
		$focus = $article['focus_keyword'] ?? '';
		$desc  = $article['meta_description'] ?? '';
		$title = $article['title'] ?? '';

		// Yoast SEO.
		if ( defined( 'WPSEO_VERSION' ) || class_exists( 'WPSEO_Options' ) ) {
			update_post_meta( $post_id, '_yoast_wpseo_focuskw', $focus );
			update_post_meta( $post_id, '_yoast_wpseo_metadesc', $desc );
			update_post_meta( $post_id, '_yoast_wpseo_title', $title );
		}

		// Rank Math.
		if ( defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath' ) ) {
			update_post_meta( $post_id, 'rank_math_focus_keyword', $focus );
			update_post_meta( $post_id, 'rank_math_description', $desc );
			update_post_meta( $post_id, 'rank_math_title', $title );
		}

		// Always store plugin-native meta as a portable fallback.
		update_post_meta( $post_id, '_dnw_focus_keyword', $focus );
		update_post_meta( $post_id, '_dnw_meta_description', $desc );
		if ( isset( $article['seo_score']['score'] ) ) {
			update_post_meta( $post_id, '_dnw_seo_score', (int) $article['seo_score']['score'] );
		}
	}
}
