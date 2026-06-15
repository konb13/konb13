"""
researcher.py – Searches Reddit and X/Twitter for trending content on a topic.
Returns a TrendReport with top posts, keywords, and angles.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

import praw
import tweepy
from dotenv import load_dotenv

load_dotenv()


@dataclass
class TrendPost:
    source: str          # "reddit" | "twitter" | "news"
    title: str
    body: str
    score: int           # upvotes / like count
    url: str
    subreddit: str = ""  # Reddit only


@dataclass
class TrendReport:
    topic: str
    posts: list[TrendPost] = field(default_factory=list)
    top_keywords: list[str] = field(default_factory=list)
    trending_angles: list[str] = field(default_factory=list)

    # Convenience
    def summary_text(self) -> str:
        lines = [f"TREND REPORT FOR: {self.topic}\n"]
        for p in self.posts[:15]:
            lines.append(f"[{p.source.upper()}] {p.title} (score:{p.score})")
            if p.body:
                lines.append(f"  {p.body[:200]}")
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Reddit
# ─────────────────────────────────────────────────────────────────────────────

def _reddit_client() -> praw.Reddit:
    return praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        user_agent=os.getenv("REDDIT_USER_AGENT", "ArticleBot/1.0"),
    )


def search_reddit(topic: str, limit: int = 20) -> list[TrendPost]:
    """Return top Reddit posts for *topic* across all subreddits."""
    reddit = _reddit_client()
    posts: list[TrendPost] = []

    # Search all subreddits
    for submission in reddit.subreddit("all").search(
        topic, sort="hot", time_filter="week", limit=limit
    ):
        body = submission.selftext[:500] if submission.selftext else ""
        posts.append(
            TrendPost(
                source="reddit",
                title=submission.title,
                body=body,
                score=submission.score,
                url=f"https://reddit.com{submission.permalink}",
                subreddit=submission.subreddit.display_name,
            )
        )

    # Also check topic-specific subreddits (sanitised name)
    sanitised = topic.lower().replace(" ", "")
    try:
        sub = reddit.subreddit(sanitised)
        for submission in sub.hot(limit=10):
            body = submission.selftext[:500] if submission.selftext else ""
            posts.append(
                TrendPost(
                    source="reddit",
                    title=submission.title,
                    body=body,
                    score=submission.score,
                    url=f"https://reddit.com{submission.permalink}",
                    subreddit=submission.subreddit.display_name,
                )
            )
    except Exception:
        pass  # subreddit may not exist

    return sorted(posts, key=lambda p: p.score, reverse=True)[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# X / Twitter
# ─────────────────────────────────────────────────────────────────────────────

def _twitter_client() -> tweepy.Client:
    return tweepy.Client(bearer_token=os.environ["TWITTER_BEARER_TOKEN"])


def search_twitter(topic: str, limit: int = 20) -> list[TrendPost]:
    """Return recent tweets for *topic* sorted by engagement."""
    client = _twitter_client()
    posts: list[TrendPost] = []

    try:
        query = f"{topic} -is:retweet lang:en"
        response = client.search_recent_tweets(
            query=query,
            max_results=min(limit, 100),
            tweet_fields=["public_metrics", "text"],
            expansions=["author_id"],
        )
        if not response.data:
            return posts

        for tweet in response.data:
            metrics = tweet.public_metrics or {}
            score = (
                metrics.get("like_count", 0)
                + metrics.get("retweet_count", 0) * 2
                + metrics.get("reply_count", 0)
            )
            posts.append(
                TrendPost(
                    source="twitter",
                    title=tweet.text[:120],
                    body=tweet.text,
                    score=score,
                    url=f"https://x.com/i/web/status/{tweet.id}",
                )
            )
    except tweepy.errors.Forbidden:
        # Free-tier Bearer token may not have search access; skip gracefully
        print("[researcher] Twitter API access limited – skipping X results.")
    except Exception as exc:
        print(f"[researcher] Twitter error: {exc}")

    return sorted(posts, key=lambda p: p.score, reverse=True)[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# News feeds (RSS/Atom)
# ─────────────────────────────────────────────────────────────────────────────

def search_news(topic: str, limit: int = 15) -> list[TrendPost]:
    """Return recent news items for *topic* from configured RSS feeds."""
    from .news import fetch_news

    posts: list[TrendPost] = []
    # Don't skip processed here: research is read-only context gathering.
    for item in fetch_news(limit=limit, topic=topic, skip_processed=False):
        posts.append(
            TrendPost(
                source="news",
                title=item.title,
                body=item.summary,
                score=0,
                url=item.link,
            )
        )
    return posts


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def research_topic(topic: str) -> TrendReport:
    """
    Aggregate news feeds + Reddit + Twitter results and return a TrendReport.
    Works even if one source fails (degrades gracefully).
    """
    posts: list[TrendPost] = []

    try:
        posts += search_news(topic)
    except Exception as exc:
        print(f"[researcher] News error: {exc}")

    try:
        posts += search_reddit(topic)
    except Exception as exc:
        print(f"[researcher] Reddit error: {exc}")

    try:
        posts += search_twitter(topic)
    except Exception as exc:
        print(f"[researcher] Twitter error: {exc}")

    posts = sorted(posts, key=lambda p: p.score, reverse=True)

    # Extract simple keyword heuristic from titles
    from collections import Counter
    import re

    words: list[str] = []
    for p in posts:
        words += re.findall(r"\b[a-zA-Z]{4,}\b", p.title.lower())
    stopwords = {
        "that", "this", "with", "from", "have", "been", "will", "your",
        "their", "about", "what", "when", "where", "which", "there", "they",
        "just", "more", "also", "some", "than", "very", "like", "make",
    }
    keywords = [w for w, _ in Counter(words).most_common(30) if w not in stopwords]

    return TrendReport(topic=topic, posts=posts, top_keywords=keywords[:15])
