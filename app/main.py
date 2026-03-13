"""
main.py – FastAPI dashboard application.

Routes:
  GET  /                   Dashboard (article grid)
  GET  /articles           Article list (JSON)
  GET  /articles/{id}/edit Article editor page
  PUT  /api/articles/{id}  Save article edits (JSON)
  POST /api/articles/{id}/publish    Publish to WordPress
  POST /api/articles/{id}/regen-image  Regenerate featured image
  POST /api/articles/{id}/upload-image  Upload custom image
  DELETE /api/articles/{id}  Delete article

  GET  /schedules          Schedule manager page
  POST /api/schedules      Create schedule
  PUT  /api/schedules/{id} Update schedule
  DELETE /api/schedules/{id} Delete schedule
  POST /api/schedules/{id}/toggle Enable/disable schedule

  POST /api/generate       Trigger manual generation job
  GET  /api/jobs           List recent generation jobs
  GET  /api/jobs/{id}      Job status (for polling)
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import traceback
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiofiles
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

load_dotenv()

# Ensure project root on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import (
    ArticleModel,
    GenerationJobModel,
    ScheduleModel,
    get_db,
    init_db,
)
from app import scheduler as sched_module
from modules.writer import TONES

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
TEMPLATES_DIR = ROOT / "app" / "templates"
STATIC_DIR = ROOT / "static"
UPLOADS_DIR = ROOT / "static" / "uploads"
IMAGES_DIR = ROOT / "generated_images"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Article Dashboard")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/generated_images", StaticFiles(directory=str(IMAGES_DIR)), name="gen_images")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    sched_module.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    sched_module.shutdown()


# ─────────────────────────────────────────────────────────────────────────────
# Template helpers
# ─────────────────────────────────────────────────────────────────────────────

def _image_url(path: str, request: Request) -> str:
    """Convert a local file path to a URL the browser can reach."""
    if not path:
        return ""
    p = Path(path)
    if p.is_relative_to(IMAGES_DIR):
        return str(request.url_for("gen_images", path=p.name))
    if p.is_relative_to(UPLOADS_DIR):
        return str(request.url_for("static", path=f"uploads/{p.name}"))
    # Absolute path under generated_images
    if p.exists():
        return str(request.url_for("gen_images", path=p.name))
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def dashboard(
    request: Request,
    status: str = "",
    search: str = "",
    db: Session = Depends(get_db),
):
    q = db.query(ArticleModel).order_by(ArticleModel.created_at.desc())
    if status:
        q = q.filter(ArticleModel.status == status)
    if search:
        q = q.filter(ArticleModel.title.ilike(f"%{search}%"))
    articles = q.limit(100).all()

    # Stats
    total = db.query(ArticleModel).count()
    published = db.query(ArticleModel).filter(ArticleModel.status == "published").count()
    drafts = db.query(ArticleModel).filter(ArticleModel.status == "draft").count()
    ready = db.query(ArticleModel).filter(ArticleModel.status == "ready").count()

    recent_jobs = (
        db.query(GenerationJobModel)
        .order_by(GenerationJobModel.created_at.desc())
        .limit(5)
        .all()
    )

    articles_data = []
    for a in articles:
        d = a.to_dict()
        d["image_url"] = _image_url(a.featured_image_path, request)
        articles_data.append(d)

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "articles": articles_data,
            "stats": {"total": total, "published": published, "drafts": drafts, "ready": ready},
            "recent_jobs": [j.to_dict() for j in recent_jobs],
            "filter_status": status,
            "search": search,
            "tones": list(TONES.keys()),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Article editor page
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/articles/{article_id}/edit", response_class=HTMLResponse)
def edit_article_page(article_id: int, request: Request, db: Session = Depends(get_db)):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    d = article.to_dict()
    d["image_url"] = _image_url(article.featured_image_path, request)
    return templates.TemplateResponse(
        "article_edit.html",
        {"request": request, "article": d, "tones": list(TONES.keys())},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Article CRUD API
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/articles")
def list_articles(db: Session = Depends(get_db)):
    articles = db.query(ArticleModel).order_by(ArticleModel.created_at.desc()).all()
    return [a.to_dict() for a in articles]


@app.put("/api/articles/{article_id}")
async def update_article(article_id: int, request: Request, db: Session = Depends(get_db)):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    data = await request.json()
    allowed = {
        "title", "slug", "meta_description", "focus_keyword",
        "html_content", "tone", "tags", "categories", "status",
    }
    for key, val in data.items():
        if key not in allowed:
            continue
        if key == "tags":
            article.tags = val if isinstance(val, list) else [v.strip() for v in str(val).split(",")]
        elif key == "categories":
            article.categories = val if isinstance(val, list) else [v.strip() for v in str(val).split(",")]
        else:
            setattr(article, key, val)

    article.updated_at = datetime.utcnow()
    db.commit()
    return article.to_dict()


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(article)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Publish to WordPress
# ─────────────────────────────────────────────────────────────────────────────

def _do_publish(article_id: int) -> None:
    from app.database import SessionLocal
    from modules.publisher import publish_article
    from modules.writer import Article as WriterArticle

    db = SessionLocal()
    try:
        db_art = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
        if not db_art:
            return
        db_art.status = "publishing"
        db.commit()

        writer_article = WriterArticle(
            topic=db_art.topic,
            focus_keyword=db_art.focus_keyword,
            title=db_art.title,
            meta_description=db_art.meta_description,
            html_content=db_art.html_content,
            tags=db_art.tags,
            categories=db_art.categories,
            slug=db_art.slug,
            tone=db_art.tone,
        )
        img_path = Path(db_art.featured_image_path) if db_art.featured_image_path else Path("")

        result = publish_article(writer_article, img_path)

        db_art.status = "published"
        db_art.wp_post_id = result.post_id
        db_art.wp_post_url = result.post_url
        db_art.wp_edit_url = result.edit_url
        db_art.wp_method = result.method
        db_art.published_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        db_art = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
        if db_art:
            db_art.status = "failed"
            db.commit()
        print(f"[publish] Error: {exc}")
    finally:
        db.close()


@app.post("/api/articles/{article_id}/publish")
def publish_article_endpoint(
    article_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    article.status = "publishing"
    db.commit()
    background_tasks.add_task(_do_publish, article_id)
    return {"ok": True, "message": "Publishing started"}


# ─────────────────────────────────────────────────────────────────────────────
# Image management
# ─────────────────────────────────────────────────────────────────────────────

def _do_regen_image(article_id: int) -> None:
    from app.database import SessionLocal
    from modules.image_gen import generate_featured_image

    db = SessionLocal()
    try:
        article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
        if not article:
            return
        img_path = generate_featured_image(article.topic, article.title)
        article.featured_image_path = str(img_path)
        article.updated_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        print(f"[image] Regen error: {exc}")
    finally:
        db.close()


@app.post("/api/articles/{article_id}/regen-image")
def regen_image(
    article_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    background_tasks.add_task(_do_regen_image, article_id)
    return {"ok": True, "message": "Image regeneration started"}


@app.post("/api/articles/{article_id}/upload-image")
async def upload_image(
    article_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    ext = Path(file.filename or "image.png").suffix or ".png"
    filename = f"upload_{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / filename

    async with aiofiles.open(dest, "wb") as f:
        content = await file.read()
        await f.write(content)

    article.featured_image_path = str(dest)
    article.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "path": str(dest), "filename": filename}


# ─────────────────────────────────────────────────────────────────────────────
# Schedules
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/schedules", response_class=HTMLResponse)
def schedules_page(request: Request, db: Session = Depends(get_db)):
    schedules = db.query(ScheduleModel).order_by(ScheduleModel.created_at.desc()).all()
    return templates.TemplateResponse(
        "schedules.html",
        {
            "request": request,
            "schedules": [s.to_dict() for s in schedules],
            "tones": list(TONES.keys()),
        },
    )


@app.post("/api/schedules")
async def create_schedule(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    s = ScheduleModel(
        category=data["category"],
        articles_per_day=int(data.get("articles_per_day", 1)),
        publish_hour=int(data.get("publish_hour", 9)),
        tone=data.get("tone", "professional"),
        language=data.get("language", "en"),
        country=data.get("country", "US"),
        image_provider=data.get("image_provider", "dalle"),
        auto_publish=bool(data.get("auto_publish", False)),
        enabled=bool(data.get("enabled", True)),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    if s.enabled:
        sched_module.register_schedule(s.id, s.publish_hour)
    return s.to_dict()


@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: int, request: Request, db: Session = Depends(get_db)):
    s = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    data = await request.json()
    for key in ("category", "tone", "language", "country", "image_provider"):
        if key in data:
            setattr(s, key, data[key])
    for key in ("articles_per_day", "publish_hour"):
        if key in data:
            setattr(s, key, int(data[key]))
    for key in ("auto_publish", "enabled"):
        if key in data:
            setattr(s, key, bool(data[key]))
    db.commit()

    # Re-register (handles enable/disable)
    if s.enabled:
        sched_module.register_schedule(s.id, s.publish_hour)
    else:
        sched_module.unregister_schedule(s.id)

    return s.to_dict()


@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    sched_module.unregister_schedule(s.id)
    db.delete(s)
    db.commit()
    return {"ok": True}


@app.post("/api/schedules/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    s.enabled = not s.enabled
    db.commit()
    if s.enabled:
        sched_module.register_schedule(s.id, s.publish_hour)
    else:
        sched_module.unregister_schedule(s.id)
    return s.to_dict()


@app.post("/api/schedules/{schedule_id}/run-now")
def run_schedule_now(
    schedule_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    s = db.query(ScheduleModel).filter(ScheduleModel.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    background_tasks.add_task(sched_module.run_scheduled_generation, schedule_id)
    return {"ok": True, "message": f"Triggered {s.articles_per_day} article(s) for '{s.category}'"}


# ─────────────────────────────────────────────────────────────────────────────
# Manual generation
# ─────────────────────────────────────────────────────────────────────────────

def _do_generate(job_id: int, topic: str, tone: str, language: str, country: str, image_provider: str) -> None:
    from app.database import SessionLocal
    from modules.researcher import research_topic, TrendReport
    from modules.writer import write_article
    from modules.image_gen import generate_featured_image

    if image_provider:
        os.environ["IMAGE_PROVIDER"] = image_provider

    db = SessionLocal()
    try:
        job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
        if not job:
            return

        # Research
        try:
            tr = research_topic(topic)
        except Exception:
            tr = TrendReport(topic=topic)

        # Write
        article_data = write_article(topic=topic, trend_report=tr, language=language, country=country, tone=tone)

        # Image
        img_path = generate_featured_image(topic, article_data.title)

        db_art = ArticleModel(
            topic=topic,
            title=article_data.title,
            slug=article_data.slug,
            meta_description=article_data.meta_description,
            focus_keyword=article_data.focus_keyword,
            html_content=article_data.html_content,
            tone=tone,
            language=language,
            country=country,
            featured_image_path=str(img_path),
            status="draft",
        )
        db_art.tags = article_data.tags
        db_art.categories = article_data.categories
        db.add(db_art)
        db.commit()
        db.refresh(db_art)

        job.status = "completed"
        job.article_id = db_art.id
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
        if job:
            job.status = "failed"
            job.error = traceback.format_exc()[:2000]
            job.completed_at = datetime.utcnow()
            db.commit()
        print(f"[generate] Job {job_id} failed: {exc}")
    finally:
        db.close()


@app.post("/api/generate")
async def generate_article(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    data = await request.json()
    topic = data.get("topic", "").strip()
    if not topic:
        raise HTTPException(status_code=422, detail="topic is required")

    job = GenerationJobModel(
        topic=topic,
        category=data.get("category", ""),
        status="running",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        _do_generate,
        job.id,
        topic,
        data.get("tone", "professional"),
        data.get("language", "en"),
        data.get("country", "US"),
        data.get("image_provider", os.getenv("IMAGE_PROVIDER", "dalle")),
    )
    return {"ok": True, "job_id": job.id}


# ─────────────────────────────────────────────────────────────────────────────
# Jobs
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = (
        db.query(GenerationJobModel)
        .order_by(GenerationJobModel.created_at.desc())
        .limit(50)
        .all()
    )
    return [j.to_dict() for j in jobs]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()
