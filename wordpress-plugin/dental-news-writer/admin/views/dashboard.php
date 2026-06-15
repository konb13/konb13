<?php
/**
 * Dashboard view.
 *
 * @package DentalNewsWriter
 * @var array $settings Plugin settings (provided by the controller).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Recently generated drafts.
$recent = get_posts(
	array(
		'post_type'      => 'post',
		'post_status'    => array( 'draft', 'pending', 'publish' ),
		'posts_per_page' => 10,
		'meta_key'       => '_dnw_generated', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		'meta_value'     => 1,                // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
		'orderby'        => 'date',
		'order'          => 'DESC',
	)
);

$has_openai = '' !== trim( (string) $settings['openai_api_key'] );
$next_run   = wp_next_scheduled( DNW_CRON_HOOK );
?>
<div class="wrap dnw-wrap">
	<h1 class="dnw-title">
		<span class="dashicons dashicons-edit-page"></span>
		<?php esc_html_e( 'Dental News Writer', 'dental-news-writer' ); ?>
	</h1>
	<p class="dnw-subtitle">
		<?php esc_html_e( 'Find trending dental news, write SEO-optimised articles in your house voice, and save them as drafts for review.', 'dental-news-writer' ); ?>
	</p>

	<?php if ( ! $has_openai ) : ?>
		<div class="notice notice-warning">
			<p>
				<?php
				printf(
					/* translators: %s: settings page URL */
					wp_kses_post( __( 'An OpenAI API key is required to write articles. <a href="%s">Add it in Settings</a>.', 'dental-news-writer' ) ),
					esc_url( admin_url( 'admin.php?page=' . DNW_Admin::SLUG . '-settings' ) )
				);
				?>
			</p>
		</div>
	<?php endif; ?>

	<div class="dnw-grid">
		<!-- Generate panel -->
		<div class="dnw-card dnw-card--primary">
			<h2><?php esc_html_e( 'Generate an article', 'dental-news-writer' ); ?></h2>
			<p class="description">
				<?php esc_html_e( 'Pull the latest trending dental story and turn it into a draft — or enter your own topic.', 'dental-news-writer' ); ?>
			</p>

			<label for="dnw-topic"><?php esc_html_e( 'Optional topic / headline override', 'dental-news-writer' ); ?></label>
			<input type="text" id="dnw-topic" class="regular-text" placeholder="<?php esc_attr_e( 'e.g. Benefits of fluoride for kids', 'dental-news-writer' ); ?>" />

			<div class="dnw-actions">
				<button type="button" class="button button-primary button-hero" id="dnw-generate" <?php disabled( ! $has_openai ); ?>>
					<span class="dashicons dashicons-welcome-write-blog"></span>
					<?php esc_html_e( 'Generate Draft Now', 'dental-news-writer' ); ?>
				</button>
				<button type="button" class="button" id="dnw-preview-news">
					<span class="dashicons dashicons-rss"></span>
					<?php esc_html_e( 'Preview Trending News', 'dental-news-writer' ); ?>
				</button>
			</div>

			<div id="dnw-status" class="dnw-status" aria-live="polite"></div>
			<div id="dnw-news-preview" class="dnw-news-preview"></div>
		</div>

		<!-- Status panel -->
		<div class="dnw-card">
			<h2><?php esc_html_e( 'Automation status', 'dental-news-writer' ); ?></h2>
			<table class="dnw-status-table">
				<tr>
					<th><?php esc_html_e( 'Schedule', 'dental-news-writer' ); ?></th>
					<td>
						<?php
						$labels = array(
							'disabled'   => __( 'Disabled (manual only)', 'dental-news-writer' ),
							'hourly'     => __( 'Hourly', 'dental-news-writer' ),
							'twicedaily' => __( 'Twice daily', 'dental-news-writer' ),
							'daily'      => __( 'Daily', 'dental-news-writer' ),
							'dnw_weekly' => __( 'Weekly', 'dental-news-writer' ),
						);
						echo esc_html( $labels[ $settings['schedule'] ] ?? $settings['schedule'] );
						?>
					</td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Next run', 'dental-news-writer' ); ?></th>
					<td><?php echo $next_run ? esc_html( get_date_from_gmt( gmdate( 'Y-m-d H:i:s', $next_run ), 'Y-m-d H:i' ) ) : esc_html__( '—', 'dental-news-writer' ); ?></td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Posts per run', 'dental-news-writer' ); ?></th>
					<td><?php echo esc_html( $settings['posts_per_run'] ); ?></td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Default status', 'dental-news-writer' ); ?></th>
					<td><?php echo esc_html( ucfirst( $settings['post_status'] ) ); ?></td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Image provider', 'dental-news-writer' ); ?></th>
					<td>
						<?php
						echo esc_html( 'higgsfield' === $settings['image_provider'] ? __( 'Higgsfield → DALL-E fallback', 'dental-news-writer' ) : __( 'DALL-E → Higgsfield fallback', 'dental-news-writer' ) );
						?>
					</td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'News feeds', 'dental-news-writer' ); ?></th>
					<td><?php echo esc_html( count( DNW_Settings::feed_list() ) ); ?></td>
				</tr>
			</table>
			<p>
				<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=' . DNW_Admin::SLUG . '-settings' ) ); ?>">
					<?php esc_html_e( 'Edit settings', 'dental-news-writer' ); ?>
				</a>
			</p>
		</div>
	</div>

	<!-- Recent drafts -->
	<div class="dnw-card">
		<h2><?php esc_html_e( 'Recently generated drafts', 'dental-news-writer' ); ?></h2>
		<?php if ( empty( $recent ) ) : ?>
			<p class="description"><?php esc_html_e( 'No articles generated yet. Click “Generate Draft Now” to create your first one.', 'dental-news-writer' ); ?></p>
		<?php else : ?>
			<table class="widefat striped dnw-recent">
				<thead>
					<tr>
						<th><?php esc_html_e( 'Title', 'dental-news-writer' ); ?></th>
						<th><?php esc_html_e( 'Status', 'dental-news-writer' ); ?></th>
						<th><?php esc_html_e( 'SEO', 'dental-news-writer' ); ?></th>
						<th><?php esc_html_e( 'Created', 'dental-news-writer' ); ?></th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $recent as $post ) : ?>
						<?php
						$seo   = (int) get_post_meta( $post->ID, '_dnw_seo_score', true );
						$class = $seo >= 80 ? 'good' : ( $seo >= 60 ? 'ok' : 'low' );
						?>
						<tr>
							<td><strong><?php echo esc_html( $post->post_title ); ?></strong></td>
							<td><span class="dnw-pill"><?php echo esc_html( $post->post_status ); ?></span></td>
							<td>
								<?php if ( $seo ) : ?>
									<span class="dnw-seo dnw-seo--<?php echo esc_attr( $class ); ?>"><?php echo esc_html( $seo ); ?></span>
								<?php else : ?>
									—
								<?php endif; ?>
							</td>
							<td><?php echo esc_html( get_the_date( 'Y-m-d H:i', $post ) ); ?></td>
							<td>
								<a class="button button-small" href="<?php echo esc_url( get_edit_post_link( $post->ID ) ); ?>">
									<?php esc_html_e( 'Edit', 'dental-news-writer' ); ?>
								</a>
							</td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</div>
