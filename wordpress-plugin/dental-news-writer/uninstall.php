<?php
/**
 * Uninstall cleanup.
 *
 * Removes plugin options and scheduled events. Generated posts and media are
 * intentionally left in place so you never lose published/draft content.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'dnw_settings' );
delete_option( 'dnw_log' );
delete_option( 'dnw_processed_guids' );
delete_transient( 'dnw_voice_profile' );

wp_clear_scheduled_hook( 'dnw_scheduled_run' );
