"""
scheduler.py – APScheduler integration.

Loads all enabled schedules from DB on startup and registers daily jobs.
Each job calls run_scheduled_generation() which:
  1. Picks trending topics for the category
  2. Runs the full pipeline for each topic (up to articles_per_day)
  3. Stores results as ArticleModel rows with status "draft" or "published"
"""

from __future__ import annotations

import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Add project root to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

scheduler = BackgroundScheduler(timezone="UTC")


# ─────────────────────────────────────────────────────────────────────────────
# Core generation logic (runs inside APScheduler thread)
# ─────────────────────────────────────────────────────────────────────────────

def run_scheduled_generation(schedule_id: int) -> None:
    """Called by APScheduler. Runs the full pipeline for one schedule."""
    from app.database import SessionLocal, ScheduleModel, GenerationJobModel, ArticleModel
    from modules.researcher import research_topic
    from modules.writer import write_article
    from modules.image_gen import generate_featured_image

    db = SessionLocal()
    try:
        schedule = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
        if not schedule or not schedule.enabled:
            return

        # Override image provider for this schedule
        if schedule.image_provider:
            os.environ["IMAGE_PROVIDER"] = schedule.image_provider

        # Discover trending topics for the category
        try:
            trend_report = research_topic(schedule.category)
            # Use top trending post titles as topics, de-duped
            candidate_topics = []
            seen: set[str] = set()
            for post in trend_report.posts:
                t = post.title[:120].strip()
                if t.lower() not in seen:
                    candidate_topics.append(t)
                    seen.add(t.lower())
            # Fall back to the category name if not enough posts
            while len(candidate_topics) < schedule.articles_per_day:
                candidate_topics.append(schedule.category)
        except Exception:
            candidate_topics = [schedule.category] * schedule.articles_per_day
            trend_report = None  # type: ignore[assignment]

        topics = candidate_topics[: schedule.articles_per_day]

        for topic in topics:
            job = GenerationJobModel(
                topic=topic,
                category=schedule.category,
                schedule_id=schedule_id,
                status="running",
            )
            db.add(job)
            db.commit()
            db.refresh(job)

            try:
                # Re-research per-topic for accuracy
                try:
                    tr = research_topic(topic)
                except Exception:
                    tr = trend_report or __import__(
                        "modules.researcher", fromlist=["TrendReport"]
                    ).TrendReport(topic=topic)

                article_data = write_article(
                    topic=topic,
                    trend_report=tr,
                    language=schedule.language,
                    country=schedule.country,
                    tone=schedule.tone,
                )

                img_path = generate_featured_image(topic, article_data.title)

                status = "draft"
                wp_post_id = None
                wp_post_url = ""
                wp_edit_url = ""
                wp_method = ""

                if schedule.auto_publish:
                    try:
                        from modules.publisher import publish_article
                        result = publish_article(article_data, img_path)
                        status = "published"
                        wp_post_id = result.post_id
                        wp_post_url = result.post_url
                        wp_edit_url = result.edit_url
                        wp_method = result.method
                    except Exception as pub_exc:
                        print(f"[scheduler] Auto-publish failed: {pub_exc}")
                        status = "draft"

                db_article = ArticleModel(
                    topic=topic,
                    title=article_data.title,
                    slug=article_data.slug,
                    meta_description=article_data.meta_description,
                    focus_keyword=article_data.focus_keyword,
                    html_content=article_data.html_content,
                    tone=schedule.tone,
                    language=schedule.language,
                    country=schedule.country,
                    featured_image_path=str(img_path),
                    status=status,
                    schedule_id=schedule_id,
                    wp_post_id=wp_post_id,
                    wp_post_url=wp_post_url,
                    wp_edit_url=wp_edit_url,
                    wp_method=wp_method,
                    published_at=datetime.utcnow() if status == "published" else None,
                )
                db_article.tags = article_data.tags
                db_article.categories = article_data.categories
                db.add(db_article)
                db.commit()
                db.refresh(db_article)

                job.status = "completed"
                job.article_id = db_article.id
                job.completed_at = datetime.utcnow()
                db.commit()

            except Exception as exc:
                job.status = "failed"
                job.error = traceback.format_exc()[:2000]
                job.completed_at = datetime.utcnow()
                db.commit()
                print(f"[scheduler] Job {job.id} failed: {exc}")

        schedule.last_run_at = datetime.utcnow()
        db.commit()

    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Schedule management
# ─────────────────────────────────────────────────────────────────────────────

def _job_id(schedule_id: int) -> str:
    return f"schedule_{schedule_id}"


def register_schedule(schedule_id: int, publish_hour: int) -> None:
    """Add or replace an APScheduler job for a DB schedule."""
    job_id = _job_id(schedule_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(
        run_scheduled_generation,
        trigger=CronTrigger(hour=publish_hour, minute=0, timezone="UTC"),
        args=[schedule_id],
        id=job_id,
        replace_existing=True,
    )


def unregister_schedule(schedule_id: int) -> None:
    job_id = _job_id(schedule_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def load_all_schedules() -> None:
    """On startup, register all enabled schedules from DB."""
    from app.database import SessionLocal, ScheduleModel

    db = SessionLocal()
    try:
        schedules = db.query(ScheduleModel).filter(ScheduleModel.enabled == True).all()
        for s in schedules:
            register_schedule(s.id, s.publish_hour)
        print(f"[scheduler] Loaded {len(schedules)} active schedule(s).")
    finally:
        db.close()


def start() -> None:
    if not scheduler.running:
        scheduler.start()
        load_all_schedules()


def shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
