=== Dental News Writer ===
Contributors: konb13
Tags: ai, content, seo, dental, automation, openai, higgsfield
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Find trending dental news, write SEO-optimised articles in your writers' voice, and auto-generate a featured image — saved as drafts for review.

== Description ==

Dental News Writer turns the latest trending dental stories into original, publish-ready draft articles for your practice blog.

* **Trend discovery** — pulls the latest items from any RSS/Atom dental news feeds you configure, filtered by keywords.
* **Writes in your voice** — learns your house style from your existing published posts *and* lets you paste a manual style guide that takes priority.
* **SEO + GEO optimised** — keyword-rich headings, TL;DR answer block, FAQ section, meta description, focus keyword, tags, and an on-page SEO score. Writes meta to Yoast or Rank Math automatically.
* **Featured images** — generates a featured image with Higgsfield, with automatic fallback to OpenAI DALL-E 3, then sideloads it into your Media Library.
* **Drafts by default** — every article is created as a Draft (configurable) so an editor approves before it goes live.
* **Automation** — optional WP-Cron schedule (hourly/twice-daily/daily/weekly) to generate a set number of drafts per run.

This plugin is self-contained PHP — install it on your WordPress site, add your API keys, and go.

== Installation ==

1. Zip the `dental-news-writer` folder and upload it via **Plugins → Add New → Upload Plugin**, or copy the folder into `wp-content/plugins/`.
2. Activate the plugin.
3. Go to **Dental News → Settings** and add:
   * Your **OpenAI API key** (required — writes the articles).
   * Optionally your **Higgsfield** key/secret/endpoint (for featured images; DALL-E is used as a fallback).
4. Review the default dental news feeds (edit/add your own), set your tone, voice options, and publishing defaults.
5. On the **Dental News** dashboard, click **Generate Draft Now**, or enable a schedule.

== Frequently Asked Questions ==

= Does it publish automatically? =
By default no — articles are saved as Drafts for review. You can change the default status (Draft / Pending / Publish) in settings.

= How does it match our writers' voice? =
It can analyse your recent published posts to build a style brief, and you can also paste a manual style guide. The manual guide takes priority. Click "Rebuild voice profile now" after big editorial changes.

= What if Higgsfield isn't set up? =
Image generation automatically falls back to OpenAI DALL-E 3. If neither is available, the article is still created without a featured image.

= Will it copy news articles? =
No. It writes an original article *inspired by* the trending angle, with instructions not to copy or present source claims as its own reporting. Always review drafts before publishing.

= Higgsfield API shape =
Higgsfield's image API is async/job-based and varies by plan. The client accepts several common response shapes and exposes the `dnw_higgsfield_request_body`, `dnw_higgsfield_headers`, and `dnw_higgsfield_poll_url` filters so you can adapt it to your account without editing core files.

== Changelog ==

= 1.0.0 =
* Initial release: trend discovery, voice-matched SEO article writing, Higgsfield/DALL-E featured images, draft workflow, and scheduling.
