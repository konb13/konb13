# Auto Article → WordPress Workflow

> **Looking for the native WordPress plugin?** See [`wordpress-plugin/dental-news-writer/`](wordpress-plugin/dental-news-writer/) — a self-contained PHP plugin that finds trending **dental** news, writes SEO articles in your writers' voice, generates a featured image (Higgsfield → DALL-E fallback), and saves drafts for review. Install it directly in WP Admin; no Python required. See its `readme.txt` for setup.

A Python CLI that:
1. **Discovers** the latest trending dental news from RSS feeds *and* researches Reddit & X/Twitter for your topic
2. **Writes** a fully SEO + GEO optimised article using GPT-4o — in your current writers' voice
3. **Scores** the article's on-page SEO (0–100) before you publish
4. **Generates** a featured image with Higgsfield (DALL-E 3 / Gemini fallback)
5. **Publishes** directly to your WordPress site on WPEngine (draft by default for review)

---

## Quick Start

### 1. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env and fill in all your API keys
```

### 3. Run

```bash
python workflow.py --from-news                          # discover & write the latest trending dental story
python workflow.py "dental implants 2025"               # research a specific topic (news + Reddit + X)
python workflow.py "teeth whitening" --image-provider higgsfield --draft
python workflow.py "keto diet tips" --no-publish        # generate only, skip WP upload
python workflow.py "travel hacks" --skip-research       # skip research (faster)
```

### New capabilities

- **`--from-news`** — pulls the freshest dental headline from your configured RSS feeds (`NEWS_FEEDS`) and writes an original article about it. Processed stories are remembered in `data/processed_news.json` so they aren't reused.
- **Writer voice** — set `VOICE_LEARN=1` to learn your house style from your site's published posts (via the WordPress REST API), and/or paste a `VOICE_STYLE_GUIDE`. The style guide takes priority. Cached for `VOICE_CACHE_HOURS`.
- **Higgsfield images** — set `IMAGE_PROVIDER=higgsfield` with `HIGGSFIELD_API_KEY`; falls back to DALL-E 3 / Gemini automatically.
- **SEO score** — every run prints an on-page SEO score (and stores it in the dashboard DB).
- **Draft by default** — set `WP_POST_STATUS=draft` to send articles for review instead of publishing live.

---

## API Keys Required

| Service | Where to get it | Used for |
|---|---|---|
| **OpenAI** | platform.openai.com | GPT-4o article writing + DALL-E 3 images |
| **Google Gemini** | aistudio.google.com | Alternative image generation |
| **Reddit** | reddit.com/prefs/apps | Trending post research |
| **X / Twitter** | developer.x.com | Trending tweet research |
| **WordPress App Password** | WP Admin → Users → Application Passwords | Publishing posts |

---

## WordPress / WPEngine Setup

### Method A – REST API (recommended)

1. In WP Admin go to **Users → Your Profile → Application Passwords**
2. Add a new application password (name it "ArticleBot")
3. Copy the generated password into `.env` as `WP_APP_PASSWORD`
4. Set `WP_USERNAME` and `WP_SITE_URL`

> **Yoast SEO:** Install the Yoast SEO plugin to automatically get your meta description and focus keyword set on each post.

### Method B – WP-CLI via WPEngine SSH Gateway (fallback)

1. Go to **WPEngine Portal → SSH Access** and note your install name
2. Add your SSH public key at **WPEngine Portal → SSH Keys**
3. Set `WPENGINE_INSTALL_NAME` and `WPENGINE_SSH_KEY_PATH` in `.env`

The workflow tries Method A first; if it fails (e.g. network issue), it automatically falls back to Method B.

---

## Environment Variables

```env
# Reddit
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=ArticleBot/1.0 by YourUsername

# X / Twitter
TWITTER_BEARER_TOKEN=...

# OpenAI
OPENAI_API_KEY=...

# Google Gemini (optional)
GEMINI_API_KEY=...

# WordPress
WP_SITE_URL=https://yoursite.wpengine.com
WP_USERNAME=your_wp_username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# WPEngine SSH (optional fallback)
WPENGINE_INSTALL_NAME=yourinstall
WPENGINE_SSH_KEY_PATH=~/.ssh/id_rsa

# Defaults
IMAGE_PROVIDER=dalle        # dalle | gemini
ARTICLE_LANGUAGE=en
TARGET_COUNTRY=US
```

---

## Project Structure

```
konb13/
├── workflow.py          # Main CLI entry point
├── requirements.txt
├── .env.example
├── modules/
│   ├── researcher.py    # Reddit + X/Twitter trending research
│   ├── writer.py        # GPT-4o SEO/GEO article generation
│   ├── image_gen.py     # DALL-E 3 / Gemini Imagen featured image
│   └── publisher.py     # WordPress REST API + WP-CLI/SSH publisher
└── generated_images/    # Local cache of generated images (auto-created)
```

---

## SEO / GEO Features

**SEO:**
- Keyword-rich H1/H2/H3 heading structure
- Focus keyword ~1–2% density
- Meta title and meta description auto-generated
- FAQ section for featured snippet targeting
- Auto-tagging and categorisation

**GEO (Generative Engine Optimisation):**
- Direct-answer TL;DR paragraph at the top (targets AI overviews)
- Structured lists and comparison tables AI engines can parse
- Authoritative, cited-style writing style
- Clear entity mentions for knowledge graph signals

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `REDDIT_CLIENT_ID` missing | Create an app at reddit.com/prefs/apps (script type) |
| Twitter 403 Forbidden | Free-tier Bearer tokens have limited search; upgrade to Basic tier |
| DALL-E rate limit | Add `--image-provider gemini` flag |
| WP REST API 401 | Check WP_USERNAME and WP_APP_PASSWORD; ensure Application Passwords is enabled |
| WPEngine SSH 403 | Add your public SSH key in WPEngine portal |
