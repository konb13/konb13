<?php
/**
 * Admin UI: menu, settings registration, asset loading, and AJAX actions.
 *
 * @package DentalNewsWriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class DNW_Admin
 */
class DNW_Admin {

	const CAP  = 'manage_options';
	const SLUG = 'dental-news-writer';

	/**
	 * Register admin hooks.
	 */
	public function init() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( 'DNW_Settings', 'register' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );

		// AJAX.
		add_action( 'wp_ajax_dnw_generate_now', array( $this, 'ajax_generate_now' ) );
		add_action( 'wp_ajax_dnw_preview_news', array( $this, 'ajax_preview_news' ) );
		add_action( 'wp_ajax_dnw_refresh_voice', array( $this, 'ajax_refresh_voice' ) );
		add_action( 'wp_ajax_dnw_clear_log', array( $this, 'ajax_clear_log' ) );

		// Settings link on the plugins screen.
		add_filter( 'plugin_action_links_' . plugin_basename( DNW_PLUGIN_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Add the admin menu + subpages.
	 */
	public function menu() {
		add_menu_page(
			__( 'Dental News Writer', 'dental-news-writer' ),
			__( 'Dental News', 'dental-news-writer' ),
			self::CAP,
			self::SLUG,
			array( $this, 'render_dashboard' ),
			'dashicons-edit-page',
			26
		);

		add_submenu_page(
			self::SLUG,
			__( 'Dashboard', 'dental-news-writer' ),
			__( 'Dashboard', 'dental-news-writer' ),
			self::CAP,
			self::SLUG,
			array( $this, 'render_dashboard' )
		);

		add_submenu_page(
			self::SLUG,
			__( 'Settings', 'dental-news-writer' ),
			__( 'Settings', 'dental-news-writer' ),
			self::CAP,
			self::SLUG . '-settings',
			array( $this, 'render_settings' )
		);

		add_submenu_page(
			self::SLUG,
			__( 'Activity Log', 'dental-news-writer' ),
			__( 'Activity Log', 'dental-news-writer' ),
			self::CAP,
			self::SLUG . '-log',
			array( $this, 'render_log' )
		);
	}

	/**
	 * Add a Settings link under the plugin name.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public function action_links( $links ) {
		$url  = admin_url( 'admin.php?page=' . self::SLUG . '-settings' );
		$link = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'dental-news-writer' ) . '</a>';
		array_unshift( $links, $link );
		return $links;
	}

	/**
	 * Enqueue admin CSS/JS on our pages only.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function assets( $hook ) {
		if ( false === strpos( $hook, self::SLUG ) ) {
			return;
		}

		wp_enqueue_style(
			'dnw-admin',
			DNW_PLUGIN_URL . 'admin/css/admin.css',
			array(),
			DNW_VERSION
		);

		wp_enqueue_script(
			'dnw-admin',
			DNW_PLUGIN_URL . 'admin/js/admin.js',
			array( 'jquery' ),
			DNW_VERSION,
			true
		);

		wp_localize_script(
			'dnw-admin',
			'DNW',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'dnw_admin' ),
				'i18n'    => array(
					'working'   => __( 'Working… this can take up to a minute.', 'dental-news-writer' ),
					'error'     => __( 'Something went wrong.', 'dental-news-writer' ),
					'confirm'   => __( 'Generate a new draft article now?', 'dental-news-writer' ),
				),
			)
		);
	}

	/* ───────────────────────────── View renderers ──────────────────────── */

	/**
	 * Render the dashboard page.
	 */
	public function render_dashboard() {
		$this->guard();
		$settings = DNW_Settings::get();
		require DNW_PLUGIN_DIR . 'admin/views/dashboard.php';
	}

	/**
	 * Render the settings page.
	 */
	public function render_settings() {
		$this->guard();
		$settings = DNW_Settings::get();
		require DNW_PLUGIN_DIR . 'admin/views/settings.php';
	}

	/**
	 * Render the activity log page.
	 */
	public function render_log() {
		$this->guard();
		$entries = DNW_Logger::all();
		require DNW_PLUGIN_DIR . 'admin/views/log.php';
	}

	/* ──────────────────────────────── AJAX ─────────────────────────────── */

	/**
	 * Verify nonce + capability for AJAX requests.
	 */
	private function verify_ajax() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'dental-news-writer' ) ), 403 );
		}
		check_ajax_referer( 'dnw_admin', 'nonce' );
	}

	/**
	 * AJAX: generate one article now.
	 */
	public function ajax_generate_now() {
		$this->verify_ajax();

		$args  = array();
		$topic = isset( $_POST['topic'] ) ? sanitize_text_field( wp_unslash( $_POST['topic'] ) ) : '';
		if ( '' !== $topic ) {
			$args['topic'] = $topic;
		}

		$result = DNW_Plugin::generate_one( $args );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success(
			array(
				'message'   => sprintf(
					/* translators: %s: article title */
					__( 'Draft created: %s', 'dental-news-writer' ),
					$result['title']
				),
				'editLink'  => $result['edit_link'],
				'seoScore'  => $result['seo_score']['score'] ?? null,
			)
		);
	}

	/**
	 * AJAX: preview trending news without generating.
	 */
	public function ajax_preview_news() {
		$this->verify_ajax();

		$settings = DNW_Settings::get();
		$fetcher  = new DNW_News_Fetcher( $settings );
		$items    = $fetcher->preview( 10 );

		if ( is_wp_error( $items ) ) {
			wp_send_json_error( array( 'message' => $items->get_error_message() ) );
		}

		$out = array();
		foreach ( $items as $it ) {
			$out[] = array(
				'title'  => $it['title'],
				'source' => $it['source'],
				'link'   => $it['link'],
			);
		}
		wp_send_json_success( array( 'items' => $out ) );
	}

	/**
	 * AJAX: rebuild the learned voice profile.
	 */
	public function ajax_refresh_voice() {
		$this->verify_ajax();

		$settings = DNW_Settings::get();
		$voice    = new DNW_Voice_Analyzer( $settings );
		$profile  = $voice->get_profile( true );

		wp_send_json_success(
			array(
				'message' => __( 'Voice profile refreshed.', 'dental-news-writer' ),
				'profile' => $profile,
			)
		);
	}

	/**
	 * AJAX: clear the activity log.
	 */
	public function ajax_clear_log() {
		$this->verify_ajax();
		DNW_Logger::clear();
		wp_send_json_success( array( 'message' => __( 'Log cleared.', 'dental-news-writer' ) ) );
	}

	/**
	 * Capability guard for page renders.
	 */
	private function guard() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'dental-news-writer' ) );
		}
	}
}
