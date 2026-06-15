<?php
/**
 * Settings view.
 *
 * @package DentalNewsWriter
 * @var array $settings Plugin settings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$opt = DNW_OPTION_KEY;

/**
 * Helper to build a field name attribute.
 *
 * @param string $key Setting key.
 * @return string
 */
$name = function ( $key ) use ( $opt ) {
	return $opt . '[' . $key . ']';
};
?>
<div class="wrap dnw-wrap">
	<h1><?php esc_html_e( 'Dental News Writer — Settings', 'dental-news-writer' ); ?></h1>

	<form method="post" action="options.php">
		<?php settings_fields( 'dnw_settings_group' ); ?>

		<!-- API keys -->
		<h2 class="title"><?php esc_html_e( 'API Credentials', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="dnw-openai-key"><?php esc_html_e( 'OpenAI API key', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="password" id="dnw-openai-key" class="regular-text" name="<?php echo esc_attr( $name( 'openai_api_key' ) ); ?>" value="<?php echo esc_attr( $settings['openai_api_key'] ); ?>" autocomplete="off" />
					<p class="description"><?php esc_html_e( 'Required. Used to write articles (and as the image fallback).', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-openai-model"><?php esc_html_e( 'OpenAI model', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="text" id="dnw-openai-model" class="regular-text" name="<?php echo esc_attr( $name( 'openai_model' ) ); ?>" value="<?php echo esc_attr( $settings['openai_model'] ); ?>" />
					<p class="description"><?php esc_html_e( 'e.g. gpt-4o, gpt-4o-mini, gpt-4.1.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-hf-key"><?php esc_html_e( 'Higgsfield API key', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="password" id="dnw-hf-key" class="regular-text" name="<?php echo esc_attr( $name( 'higgsfield_api_key' ) ); ?>" value="<?php echo esc_attr( $settings['higgsfield_api_key'] ); ?>" autocomplete="off" />
					<p class="description"><?php esc_html_e( 'Optional. For featured images. If empty or it fails, DALL-E is used automatically.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-hf-secret"><?php esc_html_e( 'Higgsfield secret', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="password" id="dnw-hf-secret" class="regular-text" name="<?php echo esc_attr( $name( 'higgsfield_secret' ) ); ?>" value="<?php echo esc_attr( $settings['higgsfield_secret'] ); ?>" autocomplete="off" />
					<p class="description"><?php esc_html_e( 'Optional second credential, if your Higgsfield plan requires a key + secret pair.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-hf-endpoint"><?php esc_html_e( 'Higgsfield endpoint', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="url" id="dnw-hf-endpoint" class="large-text" name="<?php echo esc_attr( $name( 'higgsfield_endpoint' ) ); ?>" value="<?php echo esc_attr( $settings['higgsfield_endpoint'] ); ?>" />
					<p class="description"><?php esc_html_e( 'The Higgsfield image-generation API URL. Adjust to match your account/plan.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
		</table>

		<!-- News sources -->
		<h2 class="title"><?php esc_html_e( 'News Sources', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="dnw-feeds"><?php esc_html_e( 'RSS/Atom feeds', 'dental-news-writer' ); ?></label></th>
				<td>
					<textarea id="dnw-feeds" class="large-text code" rows="6" name="<?php echo esc_attr( $name( 'feeds' ) ); ?>"><?php echo esc_textarea( $settings['feeds'] ); ?></textarea>
					<p class="description"><?php esc_html_e( 'One feed URL per line. The plugin pulls the latest items from these dental news sources.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-keywords"><?php esc_html_e( 'Keyword filter', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="text" id="dnw-keywords" class="large-text" name="<?php echo esc_attr( $name( 'keyword_filter' ) ); ?>" value="<?php echo esc_attr( $settings['keyword_filter'] ); ?>" />
					<p class="description"><?php esc_html_e( 'Comma-separated. Only items mentioning one of these are used. Leave blank to accept all items.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
		</table>

		<!-- Social trend research -->
		<h2 class="title"><?php esc_html_e( 'Social Trend Research', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Mine Reddit & X', 'dental-news-writer' ); ?></th>
				<td>
					<label><input type="checkbox" name="<?php echo esc_attr( $name( 'research_social' ) ); ?>" value="1" <?php checked( $settings['research_social'], 1 ); ?> /> <?php esc_html_e( 'Enrich each article with trending Reddit/X discussion about the topic', 'dental-news-writer' ); ?></label>
					<p class="description"><?php esc_html_e( 'Reddit works with no key. X/Twitter needs a Bearer token below; if absent, only Reddit is used.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-tw"><?php esc_html_e( 'X / Twitter Bearer token', 'dental-news-writer' ); ?></label></th>
				<td>
					<input type="password" id="dnw-tw" class="regular-text" name="<?php echo esc_attr( $name( 'twitter_bearer_token' ) ); ?>" value="<?php echo esc_attr( $settings['twitter_bearer_token'] ); ?>" autocomplete="off" />
					<p class="description"><?php esc_html_e( 'Optional. From the X developer portal (v2 recent search).', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-ua"><?php esc_html_e( 'Reddit User-Agent', 'dental-news-writer' ); ?></label></th>
				<td><input type="text" id="dnw-ua" class="regular-text" name="<?php echo esc_attr( $name( 'reddit_user_agent' ) ); ?>" value="<?php echo esc_attr( $settings['reddit_user_agent'] ); ?>" /></td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-rl"><?php esc_html_e( 'Posts per source', 'dental-news-writer' ); ?></label></th>
				<td><input type="number" id="dnw-rl" min="1" max="25" name="<?php echo esc_attr( $name( 'research_limit' ) ); ?>" value="<?php echo esc_attr( $settings['research_limit'] ); ?>" class="small-text" /></td>
			</tr>
		</table>

		<!-- Article options -->
		<h2 class="title"><?php esc_html_e( 'Article Generation', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="dnw-tone"><?php esc_html_e( 'Tone', 'dental-news-writer' ); ?></label></th>
				<td>
					<select id="dnw-tone" name="<?php echo esc_attr( $name( 'tone' ) ); ?>">
						<?php
						$tones = array( 'professional', 'casual', 'educational', 'conversational', 'authoritative', 'witty' );
						foreach ( $tones as $t ) {
							printf(
								'<option value="%s" %s>%s</option>',
								esc_attr( $t ),
								selected( $settings['tone'], $t, false ),
								esc_html( ucfirst( $t ) )
							);
						}
						?>
					</select>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-words"><?php esc_html_e( 'Target word count', 'dental-news-writer' ); ?></label></th>
				<td><input type="number" id="dnw-words" min="400" max="4000" step="100" name="<?php echo esc_attr( $name( 'word_count' ) ); ?>" value="<?php echo esc_attr( $settings['word_count'] ); ?>" /></td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-lang"><?php esc_html_e( 'Language', 'dental-news-writer' ); ?></label></th>
				<td><input type="text" id="dnw-lang" name="<?php echo esc_attr( $name( 'language' ) ); ?>" value="<?php echo esc_attr( $settings['language'] ); ?>" class="small-text" /> <span class="description"><?php esc_html_e( 'e.g. en, es, fr', 'dental-news-writer' ); ?></span></td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-country"><?php esc_html_e( 'Target country', 'dental-news-writer' ); ?></label></th>
				<td><input type="text" id="dnw-country" name="<?php echo esc_attr( $name( 'country' ) ); ?>" value="<?php echo esc_attr( $settings['country'] ); ?>" class="small-text" /> <span class="description"><?php esc_html_e( 'e.g. US, UK, AU', 'dental-news-writer' ); ?></span></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Image provider', 'dental-news-writer' ); ?></th>
				<td>
					<label><input type="radio" name="<?php echo esc_attr( $name( 'image_provider' ) ); ?>" value="higgsfield" <?php checked( $settings['image_provider'], 'higgsfield' ); ?> /> <?php esc_html_e( 'Higgsfield (DALL-E fallback)', 'dental-news-writer' ); ?></label><br />
					<label><input type="radio" name="<?php echo esc_attr( $name( 'image_provider' ) ); ?>" value="dalle" <?php checked( $settings['image_provider'], 'dalle' ); ?> /> <?php esc_html_e( 'DALL-E (Higgsfield fallback)', 'dental-news-writer' ); ?></label>
				</td>
			</tr>
		</table>

		<!-- Writer voice -->
		<h2 class="title"><?php esc_html_e( 'Writer Voice', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Learn from existing posts', 'dental-news-writer' ); ?></th>
				<td>
					<label><input type="checkbox" name="<?php echo esc_attr( $name( 'voice_learn' ) ); ?>" value="1" <?php checked( $settings['voice_learn'], 1 ); ?> /> <?php esc_html_e( 'Analyse my recent published posts to match their style', 'dental-news-writer' ); ?></label>
					<p>
						<button type="button" class="button" id="dnw-refresh-voice"><?php esc_html_e( 'Rebuild voice profile now', 'dental-news-writer' ); ?></button>
						<span id="dnw-voice-status" class="dnw-inline-status"></span>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-voice-count"><?php esc_html_e( 'Posts to analyse', 'dental-news-writer' ); ?></label></th>
				<td><input type="number" id="dnw-voice-count" min="1" max="30" name="<?php echo esc_attr( $name( 'voice_sample_count' ) ); ?>" value="<?php echo esc_attr( $settings['voice_sample_count'] ); ?>" class="small-text" /></td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-voice-pt"><?php esc_html_e( 'Post type to learn from', 'dental-news-writer' ); ?></label></th>
				<td>
					<select id="dnw-voice-pt" name="<?php echo esc_attr( $name( 'voice_post_type' ) ); ?>">
						<?php
						foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $pt ) {
							printf(
								'<option value="%s" %s>%s</option>',
								esc_attr( $pt->name ),
								selected( $settings['voice_post_type'], $pt->name, false ),
								esc_html( $pt->labels->singular_name )
							);
						}
						?>
					</select>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-style"><?php esc_html_e( 'Style guide override', 'dental-news-writer' ); ?></label></th>
				<td>
					<textarea id="dnw-style" class="large-text" rows="6" name="<?php echo esc_attr( $name( 'voice_style_guide' ) ); ?>"><?php echo esc_textarea( $settings['voice_style_guide'] ); ?></textarea>
					<p class="description"><?php esc_html_e( 'Optional. Paste a style guide or a couple of sample paragraphs. This takes priority over the learned style.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
		</table>

		<!-- Publishing -->
		<h2 class="title"><?php esc_html_e( 'Publishing', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="dnw-status-sel"><?php esc_html_e( 'Default post status', 'dental-news-writer' ); ?></label></th>
				<td>
					<select id="dnw-status-sel" name="<?php echo esc_attr( $name( 'post_status' ) ); ?>">
						<?php
						$statuses = array(
							'draft'   => __( 'Draft (review before publishing)', 'dental-news-writer' ),
							'pending' => __( 'Pending review', 'dental-news-writer' ),
							'publish' => __( 'Publish immediately', 'dental-news-writer' ),
						);
						foreach ( $statuses as $val => $label ) {
							printf(
								'<option value="%s" %s>%s</option>',
								esc_attr( $val ),
								selected( $settings['post_status'], $val, false ),
								esc_html( $label )
							);
						}
						?>
					</select>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-cat"><?php esc_html_e( 'Default category', 'dental-news-writer' ); ?></label></th>
				<td>
					<?php
					wp_dropdown_categories(
						array(
							'show_option_none' => __( '— None —', 'dental-news-writer' ),
							'option_none_value'=> 0,
							'hide_empty'       => 0,
							'selected'         => (int) $settings['post_category'],
							'name'             => $name( 'post_category' ),
							'id'               => 'dnw-cat',
						)
					);
					?>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-author"><?php esc_html_e( 'Default author', 'dental-news-writer' ); ?></label></th>
				<td>
					<?php
					wp_dropdown_users(
						array(
							'show_option_none' => __( '— Current user —', 'dental-news-writer' ),
							'option_none_value'=> 0,
							'selected'         => (int) $settings['post_author'],
							'name'             => $name( 'post_author' ),
							'id'               => 'dnw-author',
							'who'              => 'authors',
						)
					);
					?>
				</td>
			</tr>
		</table>

		<!-- Scheduling -->
		<h2 class="title"><?php esc_html_e( 'Automation Schedule', 'dental-news-writer' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="dnw-sched"><?php esc_html_e( 'Run automatically', 'dental-news-writer' ); ?></label></th>
				<td>
					<select id="dnw-sched" name="<?php echo esc_attr( $name( 'schedule' ) ); ?>">
						<?php
						$scheds = array(
							'disabled'   => __( 'Disabled (manual only)', 'dental-news-writer' ),
							'hourly'     => __( 'Hourly', 'dental-news-writer' ),
							'twicedaily' => __( 'Twice daily', 'dental-news-writer' ),
							'daily'      => __( 'Daily', 'dental-news-writer' ),
							'dnw_weekly' => __( 'Weekly', 'dental-news-writer' ),
						);
						foreach ( $scheds as $val => $label ) {
							printf(
								'<option value="%s" %s>%s</option>',
								esc_attr( $val ),
								selected( $settings['schedule'], $val, false ),
								esc_html( $label )
							);
						}
						?>
					</select>
					<p class="description"><?php esc_html_e( 'WP-Cron runs on site traffic. For precise timing, set up a real server cron hitting wp-cron.php.', 'dental-news-writer' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="dnw-ppr"><?php esc_html_e( 'Articles per run', 'dental-news-writer' ); ?></label></th>
				<td><input type="number" id="dnw-ppr" min="1" max="10" name="<?php echo esc_attr( $name( 'posts_per_run' ) ); ?>" value="<?php echo esc_attr( $settings['posts_per_run'] ); ?>" class="small-text" /></td>
			</tr>
		</table>

		<?php submit_button(); ?>
	</form>
</div>
