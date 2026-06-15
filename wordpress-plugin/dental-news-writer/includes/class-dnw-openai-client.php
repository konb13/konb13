<?php
/**
 * Thin OpenAI REST client built on the WordPress HTTP API.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_OpenAI_Client
 */
class DNW_OpenAI_Client {

	const CHAT_URL  = 'https://api.openai.com/v1/chat/completions';
	const IMAGE_URL = 'https://api.openai.com/v1/images/generations';

	/**
	 * API key.
	 *
	 * @var string
	 */
	private $api_key;

	/**
	 * Constructor.
	 *
	 * @param string $api_key OpenAI API key.
	 */
	public function __construct( $api_key ) {
		$this->api_key = $api_key;
	}

	/**
	 * Call the chat completions endpoint and return the assistant message text.
	 *
	 * @param array $messages Chat messages.
	 * @param array $args     Optional: model, temperature, max_tokens.
	 * @return string|WP_Error
	 */
	public function chat( $messages, $args = array() ) {
		if ( '' === trim( $this->api_key ) ) {
			return new WP_Error( 'dnw_no_openai_key', __( 'OpenAI API key is not configured.', 'dental-news-writer' ) );
		}

		$body = array(
			'model'       => $args['model'] ?? 'gpt-4o',
			'messages'    => $messages,
			'temperature' => isset( $args['temperature'] ) ? (float) $args['temperature'] : 0.7,
			'max_tokens'  => isset( $args['max_tokens'] ) ? (int) $args['max_tokens'] : 4096,
		);

		$response = wp_remote_post(
			self::CHAT_URL,
			array(
				'timeout' => 120,
				'headers' => array(
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = isset( $data['error']['message'] ) ? $data['error']['message'] : 'HTTP ' . $code;
			return new WP_Error( 'dnw_openai_http', sprintf( 'OpenAI error: %s', $msg ) );
		}

		$content = $data['choices'][0]['message']['content'] ?? '';
		if ( '' === $content ) {
			return new WP_Error( 'dnw_openai_empty', __( 'OpenAI returned an empty response.', 'dental-news-writer' ) );
		}

		return $content;
	}

	/**
	 * Generate an image with DALL-E 3 and return raw binary image bytes.
	 *
	 * @param string $prompt Image prompt.
	 * @param array  $args   Optional: size, quality.
	 * @return string|WP_Error Binary PNG data.
	 */
	public function image( $prompt, $args = array() ) {
		if ( '' === trim( $this->api_key ) ) {
			return new WP_Error( 'dnw_no_openai_key', __( 'OpenAI API key is not configured.', 'dental-news-writer' ) );
		}

		$body = array(
			'model'           => 'dall-e-3',
			'prompt'          => $prompt,
			'n'               => 1,
			'size'            => $args['size'] ?? '1792x1024',
			'quality'         => $args['quality'] ?? 'standard',
			'response_format' => 'b64_json',
		);

		$response = wp_remote_post(
			self::IMAGE_URL,
			array(
				'timeout' => 120,
				'headers' => array(
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = isset( $data['error']['message'] ) ? $data['error']['message'] : 'HTTP ' . $code;
			return new WP_Error( 'dnw_dalle_http', sprintf( 'DALL-E error: %s', $msg ) );
		}

		$b64 = $data['data'][0]['b64_json'] ?? '';
		if ( '' === $b64 ) {
			return new WP_Error( 'dnw_dalle_empty', __( 'DALL-E returned no image data.', 'dental-news-writer' ) );
		}

		$bytes = base64_decode( $b64 );
		if ( false === $bytes ) {
			return new WP_Error( 'dnw_dalle_decode', __( 'Could not decode DALL-E image.', 'dental-news-writer' ) );
		}

		return $bytes;
	}
}
