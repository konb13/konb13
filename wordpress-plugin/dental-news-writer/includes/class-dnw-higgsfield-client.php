<?php
/**
 * Higgsfield image-generation client (WordPress HTTP API).
 *
 * Higgsfield's API is async/job-based and its exact request and response shape
 * can vary by plan and version, so this client is written defensively:
 *   - Endpoint, auth header names, and the request payload are filterable.
 *   - It accepts several common response shapes (direct URL, base64, or a
 *     job id that is then polled).
 *
 * Adjust via the `dnw_higgsfield_request_body`, `dnw_higgsfield_headers`, and
 * `dnw_higgsfield_poll_url` filters if your account uses a different schema.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Higgsfield_Client
 */
class DNW_Higgsfield_Client {

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
	 * Generate an image and return raw image bytes.
	 *
	 * @param string $prompt Image prompt.
	 * @return string|WP_Error Binary image data.
	 */
	public function image( $prompt ) {
		$key = trim( (string) ( $this->settings['higgsfield_api_key'] ?? '' ) );
		if ( '' === $key ) {
			return new WP_Error( 'dnw_no_higgsfield_key', __( 'Higgsfield API key is not configured.', 'dental-news-writer' ) );
		}

		$endpoint = $this->settings['higgsfield_endpoint'] ?? 'https://platform.higgsfield.ai/v1/image/generate';
		$secret   = trim( (string) ( $this->settings['higgsfield_secret'] ?? '' ) );

		$headers = apply_filters(
			'dnw_higgsfield_headers',
			array(
				'Authorization' => 'Bearer ' . $key,
				'hf-api-key'    => $key,
				'hf-secret'     => $secret,
				'Content-Type'  => 'application/json',
			),
			$this->settings
		);

		$body = apply_filters(
			'dnw_higgsfield_request_body',
			array(
				'prompt'         => $prompt,
				'aspect_ratio'   => '16:9',
				'width'          => 1536,
				'height'         => 864,
				'num_images'     => 1,
				'quality'        => 'high',
			),
			$prompt,
			$this->settings
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'timeout' => 120,
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );

		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && isset( $data['message'] ) ? $data['message'] : 'HTTP ' . $code;
			return new WP_Error( 'dnw_higgsfield_http', sprintf( 'Higgsfield error: %s', $msg ) );
		}

		// Try to resolve an immediate result first.
		$bytes = $this->extract_image_bytes( $data );
		if ( ! is_wp_error( $bytes ) ) {
			return $bytes;
		}

		// Otherwise poll for a job id.
		$job_id = $this->extract_job_id( $data );
		if ( $job_id ) {
			return $this->poll_job( $endpoint, $headers, $job_id );
		}

		return new WP_Error( 'dnw_higgsfield_shape', __( 'Higgsfield response did not contain an image or job id.', 'dental-news-writer' ) );
	}

	/**
	 * Poll an async job until an image is ready.
	 *
	 * @param string $endpoint Base endpoint.
	 * @param array  $headers  Request headers.
	 * @param string $job_id   Job identifier.
	 * @return string|WP_Error
	 */
	private function poll_job( $endpoint, $headers, $job_id ) {
		$poll_url = apply_filters(
			'dnw_higgsfield_poll_url',
			trailingslashit( $this->base_url( $endpoint ) ) . 'image/jobs/' . rawurlencode( $job_id ),
			$endpoint,
			$job_id
		);

		$attempts = 0;
		$max      = 20; // ~60s total.

		while ( $attempts < $max ) {
			$attempts++;
			sleep( 3 );

			$response = wp_remote_get(
				$poll_url,
				array(
					'timeout' => 30,
					'headers' => $headers,
				)
			);
			if ( is_wp_error( $response ) ) {
				continue;
			}

			$data   = json_decode( wp_remote_retrieve_body( $response ), true );
			$status = is_array( $data ) ? ( $data['status'] ?? '' ) : '';

			if ( in_array( strtolower( (string) $status ), array( 'failed', 'error', 'canceled', 'cancelled' ), true ) ) {
				return new WP_Error( 'dnw_higgsfield_failed', __( 'Higgsfield job failed.', 'dental-news-writer' ) );
			}

			$bytes = $this->extract_image_bytes( $data );
			if ( ! is_wp_error( $bytes ) ) {
				return $bytes;
			}
		}

		return new WP_Error( 'dnw_higgsfield_timeout', __( 'Higgsfield job timed out.', 'dental-news-writer' ) );
	}

	/**
	 * Try every common place an image URL or base64 payload might live.
	 *
	 * @param mixed $data Decoded response.
	 * @return string|WP_Error Binary bytes on success.
	 */
	private function extract_image_bytes( $data ) {
		if ( ! is_array( $data ) ) {
			return new WP_Error( 'dnw_no_image', 'no image' );
		}

		$url = $this->deep_find( $data, array( 'url', 'image_url', 'imageUrl', 'output_url', 'result_url' ) );
		if ( $url && filter_var( $url, FILTER_VALIDATE_URL ) ) {
			$dl = wp_remote_get( $url, array( 'timeout' => 60 ) );
			if ( ! is_wp_error( $dl ) && 200 === (int) wp_remote_retrieve_response_code( $dl ) ) {
				$body = wp_remote_retrieve_body( $dl );
				if ( '' !== $body ) {
					return $body;
				}
			}
		}

		$b64 = $this->deep_find( $data, array( 'b64_json', 'base64', 'image_base64', 'b64' ) );
		if ( $b64 ) {
			$b64   = preg_replace( '#^data:image/[^;]+;base64,#', '', $b64 );
			$bytes = base64_decode( $b64 );
			if ( false !== $bytes && '' !== $bytes ) {
				return $bytes;
			}
		}

		return new WP_Error( 'dnw_no_image', 'no image' );
	}

	/**
	 * Recursively search an array for the first matching key.
	 *
	 * @param array $data Data.
	 * @param array $keys Candidate keys.
	 * @return string|null
	 */
	private function deep_find( $data, $keys ) {
		foreach ( $keys as $k ) {
			if ( isset( $data[ $k ] ) && is_string( $data[ $k ] ) && '' !== $data[ $k ] ) {
				return $data[ $k ];
			}
		}
		foreach ( $data as $v ) {
			if ( is_array( $v ) ) {
				$found = $this->deep_find( $v, $keys );
				if ( null !== $found ) {
					return $found;
				}
			}
		}
		return null;
	}

	/**
	 * Find a job id in the response.
	 *
	 * @param mixed $data Decoded response.
	 * @return string|null
	 */
	private function extract_job_id( $data ) {
		if ( ! is_array( $data ) ) {
			return null;
		}
		return $this->deep_find( $data, array( 'job_id', 'jobId', 'id', 'request_id', 'task_id' ) );
	}

	/**
	 * Derive a base URL (scheme://host) from a full endpoint.
	 *
	 * @param string $endpoint Endpoint URL.
	 * @return string
	 */
	private function base_url( $endpoint ) {
		$parts = wp_parse_url( $endpoint );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return $endpoint;
		}
		$base = $parts['scheme'] . '://' . $parts['host'];
		// Keep an /v1 style version prefix if present.
		if ( ! empty( $parts['path'] ) && preg_match( '#^(/v\d+)#', $parts['path'], $m ) ) {
			$base .= $m[1];
		}
		return $base;
	}
}
