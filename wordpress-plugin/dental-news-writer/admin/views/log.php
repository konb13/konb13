<?php
/**
 * Activity log view.
 *
 * @package DentalNewsWriter
 * @var array $entries Log entries (newest first).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap dnw-wrap">
	<h1><?php esc_html_e( 'Dental News Writer — Activity Log', 'dental-news-writer' ); ?></h1>

	<p>
		<button type="button" class="button" id="dnw-clear-log"><?php esc_html_e( 'Clear log', 'dental-news-writer' ); ?></button>
		<span id="dnw-log-status" class="dnw-inline-status"></span>
	</p>

	<?php if ( empty( $entries ) ) : ?>
		<p class="description"><?php esc_html_e( 'No activity yet.', 'dental-news-writer' ); ?></p>
	<?php else : ?>
		<table class="widefat striped">
			<thead>
				<tr>
					<th style="width:160px;"><?php esc_html_e( 'Time', 'dental-news-writer' ); ?></th>
					<th style="width:90px;"><?php esc_html_e( 'Level', 'dental-news-writer' ); ?></th>
					<th><?php esc_html_e( 'Message', 'dental-news-writer' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $entries as $e ) : ?>
					<tr>
						<td><?php echo esc_html( $e['time'] ); ?></td>
						<td><span class="dnw-level dnw-level--<?php echo esc_attr( $e['level'] ); ?>"><?php echo esc_html( $e['level'] ); ?></span></td>
						<td><?php echo esc_html( $e['message'] ); ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
