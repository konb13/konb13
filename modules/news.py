"""
news.py – Discovers latest trending dental (or any-topic) news from RSS/Atom feeds.

Complements researcher.py (Reddit + X) with a news-feed source. Feeds are read
with feedparser, keyword-filtered, and de-duplicated against GUIDs already
processed (stored in data/processed_news.json) so the same story isn't reused.

Configure feeds and keywords via .env:
  NEWS_FEEDS         comma- or newline-separated RSS/Atom URLs
  NEWS_KEYWORDS      comma-separated keywords an item must contain (optional)
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import feedparser
from dotenv import load_dotenv

load_dotenv()

_PROCESSED_PATH = Path(__file__).parent.parent / "data" / "processed_news.json"
_PROCESSED_MAX = 1000

# Sensible defaults for a dental practice. Override with NEWS_FEEDS.
DEFAULT_FEEDS = [
    "https://www.dentistrytoday.com/feed/",
    "https://www.dentistryiq.com/rss.xml",
    "https://www.dental-tribune.com/feed/",
    "https://news.google.com/rss/search?q=dental+OR+dentistry+when:7d&hl=en-US&gl=US&ceid=US:en",
]
DEFAULT_KEYWORDS = [
    "dental", "dentist", "dentistry", "oral health", "orthodont",
    "implant", "hygiene", "teeth", "tooth",
]


@dataclass
class NewsItem:
    title: str
    summary: str
    link: str
    source: str
    guid: str
    published: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Config helpers
# ─────────────────────────────────────────────────────────────────────────────

def _feeds() -> list[str]:
    raw = os.getenv("NEWS_FEEDS", "").strip()
    if not raw:
        return list(DEFAULT_FEEDS)
    parts = re.split(r"[,\n]+", raw)
    return [p.strip() for p in parts if p.strip()]


def _keywords() -> list[str]:
    raw = os.getenv("NEWS_KEYWORDS", "").strip()
    if not raw:
        return list(DEFAULT_KEYWORDS)
    return [k.strip().lower() for k in raw.split(",") if k.strip()]


# ─────────────────────────────────────────────────────────────────────────────
# Processed-GUID store (so we don't rewrite the same story)
# ─────────────────────────────────────────────────────────────────────────────

def _load_processed() -> list[str]:
    try:
        return json.loads(_PROCESSED_PATH.read_text())
    except Exception:
        return []


def mark_processed(guid: str) -> None:
    guids = _load_processed()
    if guid in guids:
        return
    guids.insert(0, guid)
    guids = guids[:_PROCESSED_MAX]
    _PROCESSED_PATH.parent.mkdir(exist_ok=True)
    _PROCESSED_PATH.write_text(json.dumps(guids))


# ─────────────────────────────────────────────────────────────────────────────
# Fetching
# ─────────────────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text or "")).strip()


def _matches(haystack: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    return any(kw in haystack for kw in keywords)


def fetch_news(
    limit: int = 10,
    topic: str | None = None,
    skip_processed: bool = True,
) -> list[NewsItem]:
    """
    Return up to *limit* fresh, relevant news items, newest first.

    If *topic* is given, items are additionally filtered to those mentioning it.
    """
    feeds = _feeds()
    keywords = _keywords()
    if topic:
        keywords = keywords + [topic.lower()]

    processed = set(_load_processed()) if skip_processed else set()
    items: list[NewsItem] = []
    seen_guids: set[str] = set()

    for feed_url in feeds:
        try:
            parsed = feedparser.parse(feed_url)
        except Exception:
            continue

        source = urlparse(feed_url).netloc or feed_url
        for entry in parsed.entries[:25]:
            title = _clean(getattr(entry, "title", ""))
            summary = _clean(getattr(entry, "summary", ""))
            link = getattr(entry, "link", "")
            guid = getattr(entry, "id", "") or getattr(entry, "guid", "") or link or title
            if not title or guid in processed or guid in seen_guids:
                continue

            haystack = (title + " " + summary).lower()
            if topic:
                # When a topic is set, require the topic term specifically.
                if topic.lower() not in haystack and not _matches(haystack, _keywords()):
                    continue
            elif not _matches(haystack, keywords):
                continue

            seen_guids.add(guid)
            items.append(
                NewsItem(
                    title=title,
                    summary=summary[:1200],
                    link=link,
                    source=source,
                    guid=guid,
                    published=getattr(entry, "published", "") or getattr(entry, "updated", ""),
                )
            )

    return items[: max(1, limit)]


def latest_headline(topic: str | None = None) -> NewsItem | None:
    """Convenience: return the single freshest relevant news item, or None."""
    items = fetch_news(limit=1, topic=topic)
    return items[0] if items else None
