<?php
/**
 * Lightweight activity log stored in an option (capped ring buffer).
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Logger
 */
class DNW_Logger {

	const OPTION = 'dnw_log';
	const MAX    = 200;

	/**
	 * Append a log entry.
	 *
	 * @param string $message Message text.
	 * @param string $level   info | success | warning | error.
	 */
	public function log( $message, $level = 'info' ) {
		$log = get_option( self::OPTION, array() );
		if ( ! is_array( $log ) ) {
			$log = array();
		}
		array_unshift(
			$log,
			array(
				'time'    => current_time( 'mysql' ),
				'level'   => $level,
				'message' => wp_strip_all_tags( (string) $message ),
			)
		);
		if ( count( $log ) > self::MAX ) {
			$log = array_slice( $log, 0, self::MAX );
		}
		update_option( self::OPTION, $log, false );
	}

	/**
	 * Read all log entries (newest first).
	 *
	 * @return array
	 */
	public static function all() {
		$log = get_option( self::OPTION, array() );
		return is_array( $log ) ? $log : array();
	}

	/**
	 * Clear the log.
	 */
	public static function clear() {
		update_option( self::OPTION, array(), false );
	}
}
