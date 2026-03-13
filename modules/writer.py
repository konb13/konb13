"""
writer.py – Generates an SEO + GEO optimised article using GPT-4o.

SEO features:
  • Title tag & meta description
  • H1 / H2 / H3 structure with keyword-rich headings
  • Focus keyword density ~1-2 %
  • Internal-link placeholder anchors
  • FAQ schema block
  • Word count 1 200 – 2 000 words

GEO (Generative Engine Optimisation) features:
  • Clear, direct answers at the top (snippet bait)
  • Structured lists and tables AI engines can parse
  • Authoritative, cited-style statements
  • Location / audience signals where relevant
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv
from openai import OpenAI

from .researcher import TrendReport

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Tone library
# ─────────────────────────────────────────────────────────────────────────────

TONES: dict[str, str] = {
    "professional": (
        "Write in a professional, polished tone suitable for business and industry audiences. "
        "Use precise language, avoid slang, and maintain an authoritative but approachable voice."
    ),
    "casual": (
        "Write in a casual, friendly tone as if talking to a friend. "
        "Use contractions, everyday language, and a relaxed pace. Keep it warm and approachable."
    ),
    "educational": (
        "Write in a clear, educational tone that thoroughly explains concepts step by step. "
        "Define jargon, use analogies, and assume the reader is smart but unfamiliar with the topic."
    ),
    "conversational": (
        "Write in a warm, conversational blog style. Speak directly to the reader using 'you', "
        "ask rhetorical questions, and make it feel like a natural human conversation."
    ),
    "authoritative": (
        "Write in a confident, expert-level authoritative tone. Express clear opinions backed by "
        "reasoning, reference industry standards, and position the content as definitive guidance."
    ),
    "witty": (
        "Write in a witty, entertaining tone with light, tasteful humour woven throughout. "
        "Be clever without being distracting. The information should still be useful and complete."
    ),
}

DEFAULT_TONE = "professional"


@dataclass
class Article:
    topic: str
    focus_keyword: str
    title: str
    meta_description: str
    html_content: str
    tags: list[str]
    categories: list[str]
    slug: str
    tone: str = DEFAULT_TONE


_SYSTEM_PROMPT_BASE = """
You are an expert SEO content strategist and copywriter.
Your articles are optimised for both traditional search engines (Google/Bing)
AND generative AI engines (ChatGPT Search, Perplexity, Google SGE).

Rules:
- Write entirely in valid HTML (use <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <table>).
- Do NOT wrap the HTML in markdown code fences.
- Start with an <h1> that contains the focus keyword.
- Include a concise TL;DR paragraph directly after the <h1> (GEO direct-answer).
- Use the focus keyword naturally 1–2 % of the total word count.
- Include at least 4 <h2> sections and 2 <h3> subsections.
- Add a bulleted list OR comparison table where relevant.
- End with an FAQ section: <h2>Frequently Asked Questions</h2> with at least 3 Q&A pairs using <h3> for questions.
- Target word count: 1 400–1 800 words.
- Do NOT invent statistics; state "according to recent data" where numbers would be used.
""".strip()


def _system_prompt_for_tone(tone: str) -> str:
    tone_instruction = TONES.get(tone, TONES[DEFAULT_TONE])
    return f"{_SYSTEM_PROMPT_BASE}\n\nTONE INSTRUCTION: {tone_instruction}"


def _build_user_prompt(
    topic: str,
    trend_report: TrendReport,
    language: str,
    country: str,
) -> str:
    keywords_str = ", ".join(trend_report.top_keywords[:10])
    trend_summary = trend_report.summary_text()[:2000]  # keep within token budget

    return f"""
Write a full SEO/GEO-optimised article about: **{topic}**

Target audience country: {country}
Language: {language}

### Trending context (use these angles / keywords naturally):
{trend_summary}

### Focus keyword: {topic}
### Related keywords to weave in: {keywords_str}

### Output format (JSON, then HTML):
Return a JSON object on the FIRST line (no newlines inside it) with these keys:
  title, meta_description, focus_keyword, tags (array), categories (array), slug

Then output the full HTML article body starting on the NEXT line.
tags should be 5–8 relevant tags.
categories should be 1–3 WordPress category names.
slug should be a lowercase, hyphen-separated URL slug.
""".strip()


def _parse_response(raw: str, topic: str, tone: str) -> Article:
    import json
    import re

    lines = raw.strip().splitlines()
    meta_line = lines[0].strip()

    # Robust JSON extraction – handle models that add extra text before `{`
    json_match = re.search(r"\{.*\}", meta_line)
    if not json_match:
        # Try multi-line JSON fallback
        json_match = re.search(r"\{[\s\S]*?\}", raw[:500])

    if json_match:
        meta = json.loads(json_match.group())
    else:
        # Fallback defaults
        meta = {
            "title": f"{topic} – Complete Guide",
            "meta_description": f"Everything you need to know about {topic}.",
            "focus_keyword": topic,
            "tags": [topic],
            "categories": ["General"],
            "slug": topic.lower().replace(" ", "-"),
        }

    # HTML is everything after the first line
    html_content = "\n".join(lines[1:]).strip()

    return Article(
        topic=topic,
        focus_keyword=meta.get("focus_keyword", topic),
        title=meta.get("title", f"{topic} Guide"),
        meta_description=meta.get("meta_description", ""),
        html_content=html_content,
        tags=meta.get("tags", [topic]),
        categories=meta.get("categories", ["General"]),
        slug=meta.get("slug", topic.lower().replace(" ", "-")),
        tone=tone,
    )


def write_article(
    topic: str,
    trend_report: TrendReport,
    language: str = "en",
    country: str = "US",
    tone: str = DEFAULT_TONE,
) -> Article:
    """Generate and return a full SEO/GEO optimised Article."""
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    user_prompt = _build_user_prompt(topic, trend_report, language, country)
    system_prompt = _system_prompt_for_tone(tone)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content or ""
    return _parse_response(raw, topic, tone)
