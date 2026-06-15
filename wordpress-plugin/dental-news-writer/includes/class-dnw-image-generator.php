<?php
/**
 * Generates a featured image and sideloads it into the media library.
 *
 * Provider order: Higgsfield first (per configuration), DALL-E 3 as fallback,
 * so a missing/broken Higgsfield key never blocks article creation.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Image_Generator
 */
class DNW_Image_Generator {

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
	 * Generate an image for the article and attach it to a post.
	 *
	 * @param array $article Article array.
	 * @param int   $post_id Post to attach to.
	 * @return int|WP_Error Attachment ID.
	 */
	public function generate_and_attach( $article, $post_id ) {
		$prompt = $this->build_prompt( $article );
		$bytes  = $this->generate_bytes( $prompt );
		if ( is_wp_error( $bytes ) ) {
			return $bytes;
		}

		return $this->sideload( $bytes, $article, $post_id );
	}

	/**
	 * Produce image bytes using the configured provider order with fallback.
	 *
	 * @param string $prompt Prompt.
	 * @return string|WP_Error
	 */
	private function generate_bytes( $prompt ) {
		$preferred = $this->settings['image_provider'] ?? 'higgsfield';
		$order     = ( 'dalle' === $preferred ) ? array( 'dalle', 'higgsfield' ) : array( 'higgsfield', 'dalle' );

		$last_error = null;
		foreach ( $order as $provider ) {
			if ( 'higgsfield' === $provider ) {
				if ( '' === trim( (string) ( $this->settings['higgsfield_api_key'] ?? '' ) ) ) {
					continue;
				}
				$client = new DNW_Higgsfield_Client( $this->settings );
				$bytes  = $client->image( $prompt );
			} else {
				if ( '' === trim( (string) ( $this->settings['openai_api_key'] ?? '' ) ) ) {
					continue;
				}
				$client = new DNW_OpenAI_Client( $this->settings['openai_api_key'] );
				$bytes  = $client->image( $prompt );
			}

			if ( ! is_wp_error( $bytes ) ) {
				return $bytes;
			}
			$last_error = $bytes;
		}

		return $last_error ? $last_error : new WP_Error( 'dnw_no_image_provider', __( 'No image provider is configured.', 'dental-news-writer' ) );
	}

	/**
	 * Build the image prompt.
	 *
	 * @param array $article Article.
	 * @return string
	 */
	private function build_prompt( $article ) {
		$prompt = sprintf(
			'Professional, high-quality featured blog image for a dental practice article titled "%s". '
			. 'Topic: %s. Style: clean, modern editorial photography or polished digital illustration with a '
			. 'bright, trustworthy, clinical-but-warm feel. Dental/healthcare context. No text, letters, logos, or '
			. 'watermarks in the image. Wide 16:9 format, professional colour palette.',
			$article['title'],
			$article['focus_keyword']
		);
		return apply_filters( 'dnw_image_prompt', $prompt, $article );
	}

	/**
	 * Save image bytes into the media library and attach to the post.
	 *
	 * @param string $bytes   Binary image data.
	 * @param array  $article Article.
	 * @param int    $post_id Post ID.
	 * @return int|WP_Error
	 */
	private function sideload( $bytes, $article, $post_id ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$filename = sanitize_title( $article['slug'] ?: $article['title'] );
		$filename = ( $filename ?: 'dental-featured-' . $post_id ) . '.png';

		$upload = wp_upload_bits( $filename, null, $bytes );
		if ( ! empty( $upload['error'] ) ) {
			return new WP_Error( 'dnw_upload_failed', $upload['error'] );
		}

		$filetype = wp_check_filetype( $upload['file'], null );
		$attachment = array(
			'post_mime_type' => $filetype['type'] ? $filetype['type'] : 'image/png',
			'post_title'     => $article['title'],
			'post_content'   => '',
			'post_excerpt'   => $article['meta_description'] ?? '',
			'post_status'    => 'inherit',
		);

		$attach_id = wp_insert_attachment( $attachment, $upload['file'], $post_id );
		if ( is_wp_error( $attach_id ) ) {
			return $attach_id;
		}

		$meta = wp_generate_attachment_metadata( $attach_id, $upload['file'] );
		wp_update_attachment_metadata( $attach_id, $meta );

		// Accessibility: alt text.
		update_post_meta( $attach_id, '_wp_attachment_image_alt', $article['title'] );

		return $attach_id;
	}
}
