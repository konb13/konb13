<?php
/**
 * WP-Cron scheduling for automated runs.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Cron
 */
class DNW_Cron {

	/**
	 * Add a weekly schedule to WP-Cron.
	 *
	 * @param array $schedules Existing schedules.
	 * @return array
	 */
	public static function register_schedules( $schedules ) {
		if ( ! isset( $schedules['dnw_weekly'] ) ) {
			$schedules['dnw_weekly'] = array(
				'interval' => WEEK_IN_SECONDS,
				'display'  => __( 'Once Weekly (Dental News Writer)', 'dental-news-writer' ),
			);
		}
		return $schedules;
	}

	/**
	 * (Re)schedule the recurring event based on the saved schedule setting.
	 *
	 * @param string|null $schedule Optional explicit schedule.
	 */
	public static function reschedule( $schedule = null ) {
		self::clear();

		if ( null === $schedule ) {
			$schedule = DNW_Settings::get_value( 'schedule', 'disabled' );
		}

		if ( 'disabled' === $schedule || empty( $schedule ) ) {
			return;
		}

		if ( ! wp_next_scheduled( DNW_CRON_HOOK ) ) {
			wp_schedule_event( time() + 60, $schedule, DNW_CRON_HOOK );
		}
	}

	/**
	 * Clear all scheduled occurrences.
	 */
	public static function clear() {
		$timestamp = wp_next_scheduled( DNW_CRON_HOOK );
		while ( $timestamp ) {
			wp_unschedule_event( $timestamp, DNW_CRON_HOOK );
			$timestamp = wp_next_scheduled( DNW_CRON_HOOK );
		}
		wp_clear_scheduled_hook( DNW_CRON_HOOK );
	}

	/**
	 * Cron callback: generate up to posts_per_run articles.
	 */
	public static function run() {
		$settings = DNW_Settings::get();
		$logger   = new DNW_Logger();
		$count    = (int) ( $settings['posts_per_run'] ?? 1 );

		$logger->log( sprintf( 'Scheduled run started (target: %d article(s)).', $count ) );

		$fetcher = new DNW_News_Fetcher( $settings );
		$items   = $fetcher->fetch_new( $count );

		if ( is_wp_error( $items ) ) {
			$logger->log( 'Scheduled run aborted: ' . $items->get_error_message(), 'error' );
			return;
		}
		if ( empty( $items ) ) {
			$logger->log( 'Scheduled run: no new dental news found.', 'warning' );
			return;
		}

		$made = 0;
		foreach ( $items as $item ) {
			$result = DNW_Plugin::generate_one( array( 'source_item' => $item ) );
			if ( ! is_wp_error( $result ) ) {
				$made++;
			}
		}

		$logger->log( sprintf( 'Scheduled run finished. Created %d draft(s).', $made ), 'success' );
	}
}
