#!/usr/bin/env python3
"""
workflow.py – Auto Article → WordPress Workflow
================================================

Usage:
  python workflow.py "your topic here"
  python workflow.py "AI tools for small business" --country UK --lang en
  python workflow.py "best running shoes" --image-provider gemini --draft

Options:
  --country     ISO country code for GEO targeting  (default: US)
  --lang        Language code for the article        (default: en)
  --image-provider  dalle | gemini                   (default: from .env / dalle)
  --draft       Publish as draft instead of live
  --no-publish  Generate article + image but skip publishing
  --skip-research  Skip Reddit/X research (faster, less targeted)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

load_dotenv()

console = Console()


# ─────────────────────────────────────────────────────────────────────────────
# Step runner with progress display
# ─────────────────────────────────────────────────────────────────────────────

def run_step(description: str, fn, *args, **kwargs):
    """Run *fn* with a spinner and return its result."""
    with Progress(
        SpinnerColumn(),
        TextColumn(f"[bold cyan]{description}[/bold cyan]"),
        console=console,
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        result = fn(*args, **kwargs)
    console.print(f"  [green]✓[/green] {description}")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Main workflow
# ─────────────────────────────────────────────────────────────────────────────

def run_workflow(
    topic: str,
    country: str = "US",
    language: str = "en",
    tone: str = "professional",
    image_provider: str | None = None,
    draft: bool = False,
    no_publish: bool = False,
    skip_research: bool = False,
) -> None:
    from modules.researcher import research_topic, TrendReport
    from modules.writer import write_article
    from modules.image_gen import generate_featured_image
    from modules.publisher import publish_article

    if image_provider:
        os.environ["IMAGE_PROVIDER"] = image_provider

    console.print(
        Panel(
            f"[bold]Topic:[/bold] {topic}\n"
            f"[bold]Country:[/bold] {country}  |  "
            f"[bold]Language:[/bold] {language}  |  "
            f"[bold]Tone:[/bold] {tone}  |  "
            f"[bold]Image provider:[/bold] {os.getenv('IMAGE_PROVIDER', 'dalle')}",
            title="[bold magenta]Auto Article Workflow[/bold magenta]",
            expand=False,
        )
    )

    # ── Step 1: Research ──────────────────────────────────────────────────────
    if skip_research:
        console.print("  [yellow]⚡[/yellow] Skipping trend research")
        from modules.researcher import TrendReport
        trend_report = TrendReport(topic=topic)
    else:
        trend_report = run_step(
            "Researching trends on Reddit & X/Twitter…",
            research_topic,
            topic,
        )
        console.print(
            f"     Found [bold]{len(trend_report.posts)}[/bold] trending posts, "
            f"keywords: [italic]{', '.join(trend_report.top_keywords[:6])}[/italic]"
        )

    # ── Step 2: Write article ─────────────────────────────────────────────────
    article = run_step(
        "Writing SEO/GEO optimised article with GPT-4o…",
        write_article,
        topic,
        trend_report,
        language,
        country,
        tone,
    )
    console.print(
        f"     [bold]{article.title}[/bold]\n"
        f"     Slug: [italic]{article.slug}[/italic]\n"
        f"     Meta: {article.meta_description[:80]}…"
    )

    # ── Step 3: Generate featured image ───────────────────────────────────────
    image_path = run_step(
        f"Generating featured image ({os.getenv('IMAGE_PROVIDER', 'dalle')})…",
        generate_featured_image,
        topic,
        article.title,
    )
    console.print(f"     Saved to: [italic]{image_path}[/italic]")

    # ── Store in dashboard DB ─────────────────────────────────────────────────
    try:
        from app.database import init_db, SessionLocal, ArticleModel
        init_db()
        db = SessionLocal()
        db_art = ArticleModel(
            topic=topic, title=article.title, slug=article.slug,
            meta_description=article.meta_description,
            focus_keyword=article.focus_keyword,
            html_content=article.html_content,
            tone=article.tone, language=language, country=country,
            featured_image_path=str(image_path),
            status="draft",
        )
        db_art.tags = article.tags
        db_art.categories = article.categories
        db.add(db_art)
        db.commit()
        db.close()
        console.print("  [green]✓[/green] Saved to dashboard DB (open dashboard to edit)")
    except Exception:
        pass  # Dashboard DB is optional when using CLI directly

    # ── Step 4: Publish ───────────────────────────────────────────────────────
    if no_publish:
        console.print("\n  [yellow]⚡[/yellow] --no-publish flag set, skipping upload.")
        _print_summary(article, image_path, result=None)
        return

    if draft:
        # Patch article status for draft mode – publisher reads from env
        os.environ["WP_POST_STATUS"] = "draft"

    result = run_step(
        "Publishing to WordPress on WPEngine…",
        publish_article,
        article,
        image_path,
    )

    _print_summary(article, image_path, result)


def _print_summary(article, image_path, result) -> None:
    table = Table(title="Workflow Complete", show_header=False, expand=False)
    table.add_column("Key", style="bold")
    table.add_column("Value")

    table.add_row("Title", article.title)
    table.add_row("Focus keyword", article.focus_keyword)
    table.add_row("Meta description", article.meta_description[:80] + "…")
    table.add_row("Tags", ", ".join(article.tags))
    table.add_row("Categories", ", ".join(article.categories))
    table.add_row("Featured image", str(image_path))

    if result:
        table.add_row("Post ID", str(result.post_id))
        table.add_row("Live URL", result.post_url)
        table.add_row("Edit URL", result.edit_url)
        table.add_row("Method", result.method)

    console.print()
    console.print(table)


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a trend-researched, SEO/GEO article and publish to WordPress.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("topic", help="Topic to research and write about")
    parser.add_argument(
        "--country",
        default=os.getenv("TARGET_COUNTRY", "US"),
        help="ISO country code for GEO targeting (default: US)",
    )
    parser.add_argument(
        "--lang",
        default=os.getenv("ARTICLE_LANGUAGE", "en"),
        help="Language code for the article (default: en)",
    )
    parser.add_argument(
        "--tone",
        choices=["professional", "casual", "educational", "conversational", "authoritative", "witty"],
        default="professional",
        help="Writing tone for the article (default: professional)",
    )
    parser.add_argument(
        "--image-provider",
        choices=["dalle", "gemini"],
        default=None,
        help="Image generation provider (overrides IMAGE_PROVIDER in .env)",
    )
    parser.add_argument(
        "--draft",
        action="store_true",
        help="Publish as WordPress draft instead of live",
    )
    parser.add_argument(
        "--no-publish",
        action="store_true",
        help="Generate article and image but do not publish to WordPress",
    )
    parser.add_argument(
        "--skip-research",
        action="store_true",
        help="Skip Reddit/X research (faster, uses topic alone)",
    )

    args = parser.parse_args()

    try:
        run_workflow(
            topic=args.topic,
            country=args.country,
            language=args.lang,
            tone=args.tone,
            image_provider=args.image_provider,
            draft=args.draft,
            no_publish=args.no_publish,
            skip_research=args.skip_research,
        )
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted.[/yellow]")
        sys.exit(0)
    except Exception as exc:
        console.print(f"\n[bold red]Error:[/bold red] {exc}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
