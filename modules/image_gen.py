"""
image_gen.py – Generates a featured image for the article.

Supported providers (set IMAGE_PROVIDER in .env):
  • dalle   – OpenAI DALL-E 3  (default, best quality)
  • gemini  – Google Gemini Imagen 3

Returns a local file path to the saved PNG image.
"""

from __future__ import annotations

import base64
import os
import re
import tempfile
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Output images here (created on first use)
_IMAGES_DIR = Path(__file__).parent.parent / "generated_images"


def _ensure_images_dir() -> Path:
    _IMAGES_DIR.mkdir(exist_ok=True)
    return _IMAGES_DIR


def _safe_filename(topic: str) -> str:
    return re.sub(r"[^a-z0-9_-]", "-", topic.lower().replace(" ", "-"))[:60]


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_image_prompt(topic: str, article_title: str) -> str:
    return (
        f"Professional, high-quality featured blog image for an article titled: "
        f'"{article_title}". '
        f"Topic: {topic}. "
        "Style: modern editorial photography or clean digital illustration. "
        "No text or watermarks in the image. "
        "Wide format (16:9), vibrant but professional colour palette."
    )


# ─────────────────────────────────────────────────────────────────────────────
# DALL-E 3
# ─────────────────────────────────────────────────────────────────────────────

def _generate_dalle(prompt: str, topic: str) -> Path:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1792x1024",
        quality="standard",
        n=1,
        response_format="b64_json",
    )
    b64 = response.data[0].b64_json
    if not b64:
        raise RuntimeError("DALL-E 3 returned no image data.")

    img_data = base64.b64decode(b64)
    out_path = _ensure_images_dir() / f"{_safe_filename(topic)}.png"
    out_path.write_bytes(img_data)
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Imagen 3
# ─────────────────────────────────────────────────────────────────────────────

def _generate_gemini(prompt: str, topic: str) -> Path:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

    # Imagen 3 via the generate_images API
    imagen_client = genai.ImageGenerationModel("imagen-3.0-generate-001")
    result = imagen_client.generate_images(
        prompt=prompt,
        number_of_images=1,
        aspect_ratio="16:9",
        safety_filter_level="block_some",
        person_generation="allow_adult",
    )
    if not result.images:
        raise RuntimeError("Gemini Imagen returned no images.")

    out_path = _ensure_images_dir() / f"{_safe_filename(topic)}.png"
    result.images[0]._pil_image.save(str(out_path), format="PNG")  # type: ignore[attr-defined]
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def generate_featured_image(topic: str, article_title: str) -> Path:
    """
    Generate a featured image for *topic* and return its local file path.

    Provider is chosen by the IMAGE_PROVIDER env var (dalle | gemini).
    Falls back to the other provider if the primary fails.
    """
    provider = os.getenv("IMAGE_PROVIDER", "dalle").lower()
    prompt = _build_image_prompt(topic, article_title)

    generators = {
        "dalle": _generate_dalle,
        "gemini": _generate_gemini,
    }

    # Try primary provider, then fallback
    order = [provider] + [p for p in generators if p != provider]
    last_exc: Exception | None = None

    for prov in order:
        gen_fn = generators.get(prov)
        if gen_fn is None:
            continue
        try:
            path = gen_fn(prompt, topic)
            print(f"[image_gen] Image generated via {prov}: {path}")
            return path
        except Exception as exc:
            print(f"[image_gen] {prov} failed: {exc}")
            last_exc = exc

    raise RuntimeError(
        f"All image providers failed. Last error: {last_exc}"
    )
