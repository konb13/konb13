"""
image_gen.py – Generates a featured image for the article.

Supported providers (set IMAGE_PROVIDER in .env):
  • higgsfield – Higgsfield image API (default)
  • dalle      – OpenAI DALL-E 3
  • gemini     – Google Gemini Imagen 3

Providers are tried in order starting with IMAGE_PROVIDER, then falling back to
the others, so a missing/broken provider never blocks image generation.

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
# Higgsfield
# ─────────────────────────────────────────────────────────────────────────────

def _higgsfield_extract_url(data) -> str | None:
    """Recursively search a decoded response for an image URL or base64 blob."""
    url_keys = ("url", "image_url", "imageUrl", "output_url", "result_url")
    b64_keys = ("b64_json", "base64", "image_base64", "b64")

    if isinstance(data, dict):
        for k in url_keys:
            v = data.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for k in b64_keys:
            v = data.get(k)
            if isinstance(v, str) and v:
                return "base64:" + v
        for v in data.values():
            found = _higgsfield_extract_url(v)
            if found:
                return found
    elif isinstance(data, list):
        for v in data:
            found = _higgsfield_extract_url(v)
            if found:
                return found
    return None


def _higgsfield_find_job_id(data) -> str | None:
    for key in ("job_id", "jobId", "id", "request_id", "task_id"):
        if isinstance(data, dict) and isinstance(data.get(key), str):
            return data[key]
    if isinstance(data, dict):
        for v in data.values():
            found = _higgsfield_find_job_id(v)
            if found:
                return found
    return None


def _generate_higgsfield(prompt: str, topic: str) -> Path:
    """
    Generate an image via the Higgsfield API.

    Higgsfield's API is async/job-based and varies by plan, so this is written
    defensively: it accepts a direct URL, a base64 payload, or a job id that is
    then polled. Configure via HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET /
    HIGGSFIELD_ENDPOINT in .env.
    """
    api_key = os.environ["HIGGSFIELD_API_KEY"]  # KeyError -> falls back to next provider
    secret = os.getenv("HIGGSFIELD_SECRET", "")
    endpoint = os.getenv(
        "HIGGSFIELD_ENDPOINT", "https://platform.higgsfield.ai/v1/image/generate"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "hf-api-key": api_key,
        "hf-secret": secret,
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "aspect_ratio": "16:9",
        "width": 1536,
        "height": 864,
        "num_images": 1,
        "quality": "high",
    }

    with httpx.Client(timeout=120) as client:
        resp = client.post(endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

        ref = _higgsfield_extract_url(data)

        # Poll if we only got a job id.
        if not ref:
            job_id = _higgsfield_find_job_id(data)
            if not job_id:
                raise RuntimeError("Higgsfield response had no image or job id.")
            base = endpoint.split("/v1")[0] + "/v1" if "/v1" in endpoint else endpoint
            poll_url = f"{base.rstrip('/')}/image/jobs/{job_id}"
            import time as _time

            for _ in range(20):
                _time.sleep(3)
                pr = client.get(poll_url, headers=headers)
                if pr.status_code != 200:
                    continue
                pdata = pr.json()
                status = str(pdata.get("status", "")).lower()
                if status in ("failed", "error", "canceled", "cancelled"):
                    raise RuntimeError("Higgsfield job failed.")
                ref = _higgsfield_extract_url(pdata)
                if ref:
                    break
            if not ref:
                raise RuntimeError("Higgsfield job timed out.")

        # Resolve the image bytes.
        if ref.startswith("base64:"):
            import re as _re

            raw = _re.sub(r"^data:image/[^;]+;base64,", "", ref[len("base64:") :])
            img_data = base64.b64decode(raw)
        else:
            dl = client.get(ref)
            dl.raise_for_status()
            img_data = dl.content

    out_path = _ensure_images_dir() / f"{_safe_filename(topic)}.png"
    out_path.write_bytes(img_data)
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def generate_featured_image(topic: str, article_title: str) -> Path:
    """
    Generate a featured image for *topic* and return its local file path.

    Provider is chosen by the IMAGE_PROVIDER env var (higgsfield | dalle | gemini).
    Falls back to the other providers if the primary fails.
    """
    provider = os.getenv("IMAGE_PROVIDER", "higgsfield").lower()
    prompt = _build_image_prompt(topic, article_title)

    generators = {
        "higgsfield": _generate_higgsfield,
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
