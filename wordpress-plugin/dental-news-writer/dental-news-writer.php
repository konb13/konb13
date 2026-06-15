<?php
/**
 * Plugin Name:       Dental News Writer
 * Plugin URI:        https://github.com/konb13/konb13
 * Description:        Finds trending dental news, writes SEO-optimised articles in your writers' voice, generates a featured image (Higgsfield with DALL-E fallback), and saves them as drafts for review.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            konb13
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       dental-news-writer
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'DNW_VERSION', '1.0.0' );
define( 'DNW_PLUGIN_FILE', __FILE__ );
define( 'DNW_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'DNW_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'DNW_OPTION_KEY', 'dnw_settings' );
define( 'DNW_CRON_HOOK', 'dnw_scheduled_run' );

/**
 * Autoload plugin classes from the includes directory.
 *
 * Maps class names like DNW_News_Fetcher to includes/class-dnw-news-fetcher.php.
 */
spl_autoload_register(
	function ( $class ) {
		if ( 0 !== strpos( $class, 'DNW_' ) ) {
			return;
		}
		$file = 'class-' . str_replace( '_', '-', strtolower( $class ) ) . '.php';
		$path = DNW_PLUGIN_DIR . 'includes/' . $file;
		if ( file_exists( $path ) ) {
			require_once $path;
		}
	}
);

/**
 * Boot the plugin once all plugins are loaded.
 */
function dnw_bootstrap() {
	return DNW_Plugin::instance();
}
add_action( 'plugins_loaded', 'dnw_bootstrap' );

/**
 * Activation: set defaults and schedule cron.
 */
register_activation_hook(
	__FILE__,
	function () {
		require_once DNW_PLUGIN_DIR . 'includes/class-dnw-settings.php';
		require_once DNW_PLUGIN_DIR . 'includes/class-dnw-cron.php';
		DNW_Settings::set_defaults();
		DNW_Cron::reschedule();
	}
);

/**
 * Deactivation: clear scheduled cron.
 */
register_deactivation_hook(
	__FILE__,
	function () {
		require_once DNW_PLUGIN_DIR . 'includes/class-dnw-cron.php';
		DNW_Cron::clear();
	}
);
