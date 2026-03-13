"""
database.py – SQLAlchemy models and DB initialisation.
Uses SQLite stored at ./data/articles.db
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text, create_engine
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DB_PATH = Path(__file__).parent.parent / "data" / "articles.db"
DB_PATH.parent.mkdir(exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ArticleModel(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String(500), nullable=False)
    title = Column(String(500), nullable=False)
    slug = Column(String(500), nullable=False)
    meta_description = Column(Text, default="")
    focus_keyword = Column(String(300), default="")
    html_content = Column(Text, default="")
    tone = Column(String(50), default="professional")
    language = Column(String(10), default="en")
    country = Column(String(10), default="US")

    # Comma-separated lists stored as JSON strings
    _tags = Column("tags", Text, default="[]")
    _categories = Column("categories", Text, default="[]")

    # Image
    featured_image_path = Column(String(1000), default="")
    image_prompt = Column(Text, default="")

    # Status: draft | ready | publishing | published | failed
    status = Column(String(30), default="draft")

    # Schedule link
    schedule_id = Column(Integer, nullable=True)

    # WordPress
    wp_post_id = Column(Integer, nullable=True)
    wp_post_url = Column(String(1000), default="")
    wp_edit_url = Column(String(1000), default="")
    wp_method = Column(String(30), default="")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    @property
    def tags(self) -> list[str]:
        try:
            return json.loads(self._tags or "[]")
        except Exception:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self._tags = json.dumps(value)

    @property
    def categories(self) -> list[str]:
        try:
            return json.loads(self._categories or "[]")
        except Exception:
            return []

    @categories.setter
    def categories(self, value: list[str]) -> None:
        self._categories = json.dumps(value)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "topic": self.topic,
            "title": self.title,
            "slug": self.slug,
            "meta_description": self.meta_description,
            "focus_keyword": self.focus_keyword,
            "html_content": self.html_content,
            "tone": self.tone,
            "language": self.language,
            "country": self.country,
            "tags": self.tags,
            "categories": self.categories,
            "featured_image_path": self.featured_image_path,
            "image_prompt": self.image_prompt,
            "status": self.status,
            "schedule_id": self.schedule_id,
            "wp_post_id": self.wp_post_id,
            "wp_post_url": self.wp_post_url,
            "wp_edit_url": self.wp_edit_url,
            "wp_method": self.wp_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
        }


class ScheduleModel(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(200), nullable=False)
    articles_per_day = Column(Integer, default=1)       # 1–5
    publish_hour = Column(Integer, default=9)            # 0–23 UTC
    tone = Column(String(50), default="professional")
    language = Column(String(10), default="en")
    country = Column(String(10), default="US")
    image_provider = Column(String(20), default="dalle")
    auto_publish = Column(Boolean, default=False)        # True = publish live immediately
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_run_at = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "articles_per_day": self.articles_per_day,
            "publish_hour": self.publish_hour,
            "tone": self.tone,
            "language": self.language,
            "country": self.country,
            "image_provider": self.image_provider,
            "auto_publish": self.auto_publish,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
        }


class GenerationJobModel(Base):
    __tablename__ = "generation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String(500), nullable=False)
    category = Column(String(200), default="")
    schedule_id = Column(Integer, nullable=True)
    # pending | running | completed | failed
    status = Column(String(20), default="pending")
    error = Column(Text, default="")
    article_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "topic": self.topic,
            "category": self.category,
            "schedule_id": self.schedule_id,
            "status": self.status,
            "error": self.error,
            "article_id": self.article_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Init
# ─────────────────────────────────────────────────────────────────────────────

def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
