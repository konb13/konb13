"""
seo.py – Simple on-page SEO scorer for generated articles.

Returns a 0-100 score plus the individual checks, so the CLI/dashboard can show
how well an article is optimised before publishing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class SeoResult:
    score: int
    checks: dict[str, bool] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    word_count: int = 0
    density: float = 0.0


def _strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def score_article(
    title: str,
    focus_keyword: str,
    meta_description: str,
    slug: str,
    html_content: str,
) -> SeoResult:
    kw = (focus_keyword or "").lower().strip()
    text = _strip_html(html_content).lower()
    word_count = len(text.split())

    checks: dict[str, bool] = {}
    notes: list[str] = []

    checks["kw_in_title"] = bool(kw) and kw in (title or "").lower()
    kw_slug = _slugify(kw)
    checks["kw_in_slug"] = bool(kw_slug) and kw_slug in (slug or "").lower()
    checks["kw_in_meta"] = bool(kw) and kw in (meta_description or "").lower()

    meta_len = len(meta_description or "")
    checks["meta_length"] = 120 <= meta_len <= 160
    if not checks["meta_length"]:
        notes.append(f"Meta description is {meta_len} chars (aim for 120-160).")

    first_para = ""
    m = re.search(r"<p[^>]*>(.*?)</p>", html_content or "", re.I | re.S)
    if m:
        first_para = _strip_html(m.group(1)).lower()
    checks["kw_in_intro"] = bool(kw) and kw in first_para

    checks["has_h1"] = bool(re.search(r"<h1[^>]*>", html_content or "", re.I))
    h2_count = len(re.findall(r"<h2[^>]*>", html_content or "", re.I))
    checks["enough_h2"] = h2_count >= 3
    checks["has_list"] = bool(re.search(r"<(ul|ol)[^>]*>", html_content or "", re.I))

    checks["length_ok"] = word_count >= 800
    if not checks["length_ok"]:
        notes.append(f"Article is {word_count} words (aim for 800+).")

    kw_count = text.count(kw) if kw else 0
    density = (kw_count / word_count * 100) if word_count else 0.0
    checks["density_ok"] = 0.5 <= density <= 2.5
    if not checks["density_ok"]:
        notes.append(f"Keyword density is {density:.2f}% (aim for 0.5-2.5%).")

    checks["has_faq"] = "frequently asked questions" in text

    passed = sum(1 for v in checks.values() if v)
    total = len(checks) or 1
    score = round(passed / total * 100)

    return SeoResult(
        score=score,
        checks=checks,
        notes=notes,
        word_count=word_count,
        density=round(density, 2),
    )
