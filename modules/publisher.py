"""
publisher.py – Publishes the article + featured image to WordPress on WPEngine.

Two publish methods (tried in order):
  1. WordPress REST API  (recommended – works from any machine)
  2. WP-CLI via SSH Gateway  (WPEngine SSH fallback)

WordPress REST API setup:
  WP Admin → Users → Your profile → Application Passwords → add one.
  Set WP_USERNAME and WP_APP_PASSWORD in .env.

WPEngine SSH Gateway setup:
  WP Admin → WPEngine → SSH Access → copy your connection string.
  Add your public key at: WPEngine portal → SSH Keys.
  Set WPENGINE_INSTALL_NAME and WPENGINE_SSH_KEY_PATH in .env.
"""

from __future__ import annotations

import base64
import json
import os
import shlex
import tempfile
from dataclasses import dataclass
from pathlib import Path

import requests
from dotenv import load_dotenv

from .writer import Article

load_dotenv()


@dataclass
class PublishResult:
    post_id: int
    post_url: str
    edit_url: str
    method: str  # "rest_api" | "wpcli_ssh"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _wp_auth_header() -> str:
    username = os.environ["WP_USERNAME"]
    app_password = os.environ["WP_APP_PASSWORD"]
    token = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    return f"Basic {token}"


def _wp_base_url() -> str:
    site = os.environ["WP_SITE_URL"].rstrip("/")
    return f"{site}/wp-json/wp/v2"


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 – Upload featured image to WP media library
# ─────────────────────────────────────────────────────────────────────────────

def _upload_media(image_path: Path, article_title: str) -> int:
    """Upload image file and return the WordPress media attachment ID."""
    url = f"{_wp_base_url()}/media"
    headers = {
        "Authorization": _wp_auth_header(),
        "Content-Disposition": f'attachment; filename="{image_path.name}"',
        "Content-Type": "image/png",
    }
    with open(image_path, "rb") as f:
        response = requests.post(url, headers=headers, data=f, timeout=60)
    response.raise_for_status()
    media_id: int = response.json()["id"]
    print(f"[publisher] Media uploaded → ID {media_id}")
    return media_id


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 – Resolve or create categories / tags
# ─────────────────────────────────────────────────────────────────────────────

def _get_or_create_terms(names: list[str], taxonomy: str) -> list[int]:
    """Return list of term IDs, creating missing terms."""
    base = _wp_base_url()
    endpoint = f"{base}/{'categories' if taxonomy == 'category' else 'tags'}"
    headers = {"Authorization": _wp_auth_header()}
    ids: list[int] = []

    for name in names:
        # Search existing
        r = requests.get(endpoint, params={"search": name}, headers=headers, timeout=30)
        r.raise_for_status()
        results = r.json()
        match = next((t for t in results if t["name"].lower() == name.lower()), None)
        if match:
            ids.append(match["id"])
        else:
            # Create
            r2 = requests.post(
                endpoint, json={"name": name}, headers=headers, timeout=30
            )
            r2.raise_for_status()
            ids.append(r2.json()["id"])

    return ids


# ─────────────────────────────────────────────────────────────────────────────
# Method A – WordPress REST API
# ─────────────────────────────────────────────────────────────────────────────

def _publish_via_rest_api(article: Article, image_path: Path) -> PublishResult:
    media_id = _upload_media(image_path, article.title)

    category_ids = _get_or_create_terms(article.categories, "category")
    tag_ids = _get_or_create_terms(article.tags, "tag")

    # Build Yoast-compatible meta (works with Yoast SEO plugin)
    post_payload = {
        "title": article.title,
        "content": article.html_content,
        "slug": article.slug,
        "status": os.getenv("WP_POST_STATUS", "publish"),
        "featured_media": media_id,
        "categories": category_ids,
        "tags": tag_ids,
        "meta": {
            # Yoast SEO fields (plugin must be active)
            "_yoast_wpseo_title": article.title,
            "_yoast_wpseo_metadesc": article.meta_description,
            "_yoast_wpseo_focuskw": article.focus_keyword,
        },
    }

    headers = {
        "Authorization": _wp_auth_header(),
        "Content-Type": "application/json",
    }
    url = f"{_wp_base_url()}/posts"
    response = requests.post(url, json=post_payload, headers=headers, timeout=60)
    response.raise_for_status()

    data = response.json()
    post_id: int = data["id"]
    post_url: str = data.get("link", "")
    site = os.environ["WP_SITE_URL"].rstrip("/")
    edit_url = f"{site}/wp-admin/post.php?post={post_id}&action=edit"

    print(f"[publisher] Post published via REST API → ID {post_id}")
    return PublishResult(
        post_id=post_id,
        post_url=post_url,
        edit_url=edit_url,
        method="rest_api",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Method B – WP-CLI via WPEngine SSH Gateway
# ─────────────────────────────────────────────────────────────────────────────

def _publish_via_wpcli_ssh(article: Article, image_path: Path) -> PublishResult:
    """
    Uses paramiko to SSH into the WPEngine SSH Gateway and run WP-CLI commands.

    WPEngine SSH format:  {install_name}@{install_name}.ssh.wpengine.net
    """
    import paramiko

    install = os.environ["WPENGINE_INSTALL_NAME"]
    ssh_host = f"{install}.ssh.wpengine.net"
    ssh_user = install
    key_path = os.path.expanduser(
        os.getenv("WPENGINE_SSH_KEY_PATH", "~/.ssh/id_rsa")
    )

    key = paramiko.RSAKey.from_private_key_file(key_path)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(ssh_host, username=ssh_user, pkey=key, timeout=30)

    try:
        # Upload image via SFTP
        sftp = client.open_sftp()
        remote_tmp = f"/tmp/{image_path.name}"
        sftp.put(str(image_path), remote_tmp)
        sftp.close()

        # Import image into media library
        _, stdout, stderr = client.exec_command(
            f"wp media import {shlex.quote(remote_tmp)} "
            f"--title={shlex.quote(article.title)} --porcelain"
        )
        media_id_str = stdout.read().decode().strip()
        media_id = int(media_id_str) if media_id_str.isdigit() else 0

        # Build category / tag args
        cats = ",".join(shlex.quote(c) for c in article.categories)
        tags = ",".join(shlex.quote(t) for t in article.tags)

        # Create the post
        content_escaped = article.html_content.replace("'", "'\\''")
        title_escaped = article.title.replace("'", "'\\''")
        slug_clean = article.slug

        post_status = os.getenv("WP_POST_STATUS", "publish")
        cmd = (
            f"wp post create "
            f"--post_title='{title_escaped}' "
            f"--post_content='{content_escaped}' "
            f"--post_status={shlex.quote(post_status)} "
            f"--post_name='{slug_clean}' "
            f"--post_category='{cats}' "
            f"--tags_input='{tags}' "
            f"--porcelain"
        )
        _, stdout, stderr = client.exec_command(cmd)
        post_id_str = stdout.read().decode().strip()
        post_id = int(post_id_str) if post_id_str.isdigit() else 0

        # Set featured image
        if media_id and post_id:
            client.exec_command(
                f"wp post meta set {post_id} _thumbnail_id {media_id}"
            )

        # Set Yoast SEO meta
        if post_id:
            for key_name, val in [
                ("_yoast_wpseo_title", article.title),
                ("_yoast_wpseo_metadesc", article.meta_description),
                ("_yoast_wpseo_focuskw", article.focus_keyword),
            ]:
                val_esc = val.replace("'", "'\\''")
                client.exec_command(
                    f"wp post meta set {post_id} {key_name} '{val_esc}'"
                )

        site = os.environ["WP_SITE_URL"].rstrip("/")
        post_url = f"{site}/?p={post_id}"
        edit_url = f"{site}/wp-admin/post.php?post={post_id}&action=edit"

        print(f"[publisher] Post published via WP-CLI/SSH → ID {post_id}")
        return PublishResult(
            post_id=post_id,
            post_url=post_url,
            edit_url=edit_url,
            method="wpcli_ssh",
        )
    finally:
        client.close()


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def publish_article(article: Article, image_path: Path) -> PublishResult:
    """
    Publish *article* with *image_path* as its featured image.

    Tries REST API first (recommended), falls back to WP-CLI/SSH.
    """
    # Prefer REST API – works from any machine, no SSH key needed
    try:
        return _publish_via_rest_api(article, image_path)
    except Exception as exc:
        print(f"[publisher] REST API failed ({exc}), trying WP-CLI/SSH…")

    # Fallback: WP-CLI via WPEngine SSH Gateway
    return _publish_via_wpcli_ssh(article, image_path)
