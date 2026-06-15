"""
voice.py – Builds a "writer voice" profile so generated articles sound like
your current writers.

Two sources are combined:
  1. Auto-learned style brief from your site's recently published posts
     (pulled via the WordPress REST API).
  2. A manual style guide / sample text you supply.

The learned brief is cached to data/voice_profile.txt for VOICE_CACHE_HOURS so
it isn't rebuilt on every run.

Relevant .env settings:
  VOICE_LEARN=1                 # 1 to learn from existing posts, 0 to skip
  VOICE_SAMPLE_COUNT=8          # how many recent posts to analyse
  VOICE_STYLE_GUIDE=...         # manual style guide (takes priority)
  VOICE_CACHE_HOURS=24
  WP_SITE_URL=...               # used to read published posts
"""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

_CACHE_PATH = Path(__file__).parent.parent / "data" / "voice_profile.txt"


# ─────────────────────────────────────────────────────────────────────────────
# Fetch sample posts from WordPress
# ─────────────────────────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def _fetch_recent_posts(count: int) -> list[tuple[str, str]]:
    """Return [(title, plain_text), ...] from the site's latest published posts."""
    site = os.getenv("WP_SITE_URL", "").rstrip("/")
    if not site:
        return []

    url = f"{site}/wp-json/wp/v2/posts"
    try:
        resp = requests.get(
            url,
            params={"per_page": max(1, min(30, count)), "status": "publish", "_fields": "title,content"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"[voice] Could not fetch posts: {exc}")
        return []

    samples: list[tuple[str, str]] = []
    for post in data:
        title = _strip_html((post.get("title") or {}).get("rendered", ""))
        body = _strip_html((post.get("content") or {}).get("rendered", ""))
        if body:
            samples.append((title, body[:900]))
    return samples


# ─────────────────────────────────────────────────────────────────────────────
# Summarise style into a reusable brief
# ─────────────────────────────────────────────────────────────────────────────

def _summarise_style(samples: list[tuple[str, str]]) -> str:
    joined = "\n\n".join(f'— "{t}": {b}' for t, b in samples)

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return (
            "Imitate the vocabulary, sentence length and rhythm of these excerpts:\n"
            + joined[:2500]
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=os.getenv("VOICE_MODEL", "gpt-4o-mini"),
            messages=[
                {
                    "role": "system",
                    "content": "You distil writing style into concise, reusable briefs.",
                },
                {
                    "role": "user",
                    "content": (
                        "Analyse these article excerpts from a single publication's blog. "
                        "Write a concise, reusable style brief (max 250 words): tone, formality, "
                        "sentence length, jargon vs plain language, how they address the reader, "
                        "typical structure, and any signature phrasing. Output only the brief.\n\n"
                        + joined
                    ),
                },
            ],
            temperature=0.3,
            max_tokens=600,
        )
        brief = (resp.choices[0].message.content or "").strip()
        return brief or ("Imitate these excerpts' voice:\n" + joined[:2500])
    except Exception as exc:
        print(f"[voice] Style summarisation failed: {exc}")
        return "Imitate these excerpts' voice:\n" + joined[:2500]


# ─────────────────────────────────────────────────────────────────────────────
# Cache
# ─────────────────────────────────────────────────────────────────────────────

def _cache_fresh() -> bool:
    if not _CACHE_PATH.exists():
        return False
    hours = float(os.getenv("VOICE_CACHE_HOURS", "24"))
    age = time.time() - _CACHE_PATH.stat().st_mtime
    return age < hours * 3600


def _read_cache() -> str:
    try:
        return _CACHE_PATH.read_text().strip()
    except Exception:
        return ""


def _write_cache(text: str) -> None:
    _CACHE_PATH.parent.mkdir(exist_ok=True)
    _CACHE_PATH.write_text(text)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def learned_profile(force_refresh: bool = False) -> str:
    """Return (and cache) a style brief learned from existing posts."""
    if not force_refresh and _cache_fresh():
        return _read_cache()

    count = int(os.getenv("VOICE_SAMPLE_COUNT", "8"))
    samples = _fetch_recent_posts(count)
    if not samples:
        return ""

    brief = _summarise_style(samples)
    _write_cache(brief)
    return brief


def get_voice_profile(force_refresh: bool = False) -> str:
    """
    Return the combined voice profile fed to the writer.

    Manual style guide (VOICE_STYLE_GUIDE) takes priority over the learned brief.
    """
    parts: list[str] = []

    if os.getenv("VOICE_LEARN", "1") not in ("0", "false", "False", ""):
        learned = learned_profile(force_refresh)
        if learned:
            parts.append("LEARNED HOUSE STYLE (from your published articles):\n" + learned)

    manual = os.getenv("VOICE_STYLE_GUIDE", "").strip()
    if manual:
        parts.append(
            "EDITOR-SUPPLIED STYLE GUIDE (highest priority — follow closely):\n" + manual
        )

    if not parts:
        return ""

    return "\n\n".join(parts)
