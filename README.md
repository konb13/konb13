# Auto Article → WordPress Workflow

> **Looking for the native WordPress plugin?** See [`wordpress-plugin/dental-news-writer/`](wordpress-plugin/dental-news-writer/) — a self-contained PHP plugin that finds trending **dental** news, writes SEO articles in your writers' voice, generates a featured image (Higgsfield → DALL-E fallback), and saves drafts for review. Install it directly in WP Admin; no Python required. See its `readme.txt` for setup.

A Python CLI that:
1. **Researches** trending content on Reddit & X/Twitter for your topic
2. **Writes** a fully SEO + GEO optimised article using GPT-4o
3. **Generates** a featured image with DALL-E 3 or Gemini Imagen 3
4. **Publishes** directly to your WordPress site on WPEngine

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
python workflow.py "best AI tools for small business"
python workflow.py "electric vehicles 2025" --country UK --image-provider gemini
python workflow.py "home gym equipment" --draft        # publish as draft
python workflow.py "keto diet tips" --no-publish       # generate only, skip WP upload
python workflow.py "travel hacks" --skip-research      # skip Reddit/X (faster)
```

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
