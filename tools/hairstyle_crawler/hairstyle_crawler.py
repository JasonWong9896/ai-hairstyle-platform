#!/usr/bin/env python3
"""
Download hairstyle reference images from Wikimedia Commons.

The crawler uses the public MediaWiki API, stores images locally, and writes a
metadata JSONL file with source URLs and attribution fields when available.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_URL = "https://commons.wikimedia.org/w/api.php"
LOREMFLICKR_URL = "https://loremflickr.com/768/1024/hair,hairstyle,model/all"
USER_AGENT = "AIHairstylePlatformCrawler/1.0 (local research image collector)"

DEFAULT_QUERIES = [
    "fashion model hairstyle photograph",
    "female model hairstyle photograph",
    "male model hairstyle photograph",
    "short hairstyle photograph",
    "long wavy hairstyle photograph",
    "bob haircut model photograph",
    "curly hairstyle model photograph",
    "hair salon model photograph",
]

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
SKIP_TITLE_WORDS = {
    "painting",
    "drawing",
    "engraving",
    "sculpture",
    "statue",
    "bust",
    "miniature",
    "manuscript",
}


def safe_print(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8"))


def request_json(url: str, params: dict[str, Any], timeout: int) -> dict[str, Any]:
    query = urlencode(params)
    request = Request(f"{url}?{query}", headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download_bytes(url: str, timeout: int) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def file_extension(url: str, mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type) or Path(url).suffix
    if ext == ".jpe":
        return ".jpg"
    return ext.lower() or ".jpg"


def search_commons(query: str, limit: int, timeout: int) -> list[dict[str, Any]]:
    payload = request_json(
        API_URL,
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrnamespace": 6,
            "gsrsearch": query,
            "gsrlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|mime|size|extmetadata",
        },
        timeout,
    )

    pages = payload.get("query", {}).get("pages", {})
    return list(pages.values())


def image_record(page: dict[str, Any], query: str) -> dict[str, Any] | None:
    title = page.get("title", "")
    title_lower = title.lower()
    if any(word in title_lower for word in SKIP_TITLE_WORDS):
        return None

    image_info = (page.get("imageinfo") or [{}])[0]
    image_url = image_info.get("url")
    mime_type = image_info.get("mime")
    width = int(image_info.get("width") or 0)
    height = int(image_info.get("height") or 0)

    if not image_url or mime_type not in IMAGE_MIME_TYPES:
        return None

    metadata = image_info.get("extmetadata") or {}

    def meta(name: str) -> str:
        return clean_text((metadata.get(name) or {}).get("value"))

    return {
        "query": query,
        "title": title,
        "source_url": image_url,
        "description_url": image_info.get("descriptionurl", ""),
        "mime": mime_type,
        "width": width,
        "height": height,
        "artist": meta("Artist"),
        "credit": meta("Credit"),
        "license": meta("LicenseShortName"),
        "usage_terms": meta("UsageTerms"),
    }


def should_keep(record: dict[str, Any], min_width: int, min_height: int) -> bool:
    return record["width"] >= min_width and record["height"] >= min_height


def save_image(record: dict[str, Any], output_dir: Path, timeout: int) -> Path:
    image_url = record["source_url"]
    digest = hashlib.sha1(image_url.encode("utf-8")).hexdigest()[:14]
    ext = file_extension(image_url, record["mime"])
    filename = f"hairstyle_{digest}{ext}"
    path = output_dir / filename

    if not path.exists():
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                path.write_bytes(download_bytes(image_url, timeout))
                return path
            except HTTPError as exc:
                last_error = exc
                if exc.code != 429:
                    raise
                time.sleep(5 * (attempt + 1))

        if last_error:
            raise last_error

    return path


def crawl(args: argparse.Namespace) -> None:
    if args.source == "loremflickr":
        crawl_loremflickr(args)
        return

    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = output_dir / "metadata.jsonl"
    seen_urls: set[str] = set()
    downloaded = 0

    if metadata_path.exists():
        for line in metadata_path.read_text(encoding="utf-8").splitlines():
            try:
                seen_urls.add(json.loads(line)["source_url"])
            except (KeyError, json.JSONDecodeError):
                continue

    queries = args.query or DEFAULT_QUERIES

    with metadata_path.open("a", encoding="utf-8") as metadata_file:
        for query in queries:
            if downloaded >= args.count:
                break

            safe_print(f"Searching: {query}")

            try:
                pages = search_commons(query, args.per_query, args.timeout)
            except (HTTPError, URLError, TimeoutError) as exc:
                safe_print(f"  search failed: {exc}")
                continue

            for page in pages:
                if downloaded >= args.count:
                    break

                record = image_record(page, query)
                if not record:
                    continue

                if record["source_url"] in seen_urls:
                    continue

                if not should_keep(record, args.min_width, args.min_height):
                    continue

                try:
                    saved_path = save_image(record, output_dir, args.timeout)
                except (HTTPError, URLError, TimeoutError) as exc:
                    safe_print(f"  download failed: {record['title']} - {exc}")
                    continue

                record["local_path"] = str(saved_path)
                metadata_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                metadata_file.flush()

                seen_urls.add(record["source_url"])
                downloaded += 1
                safe_print(f"  saved {downloaded}/{args.count}: {saved_path.name}")
                time.sleep(args.delay)

    safe_print(f"Done. Downloaded {downloaded} new images to {output_dir}")
    safe_print(f"Metadata: {metadata_path}")


def crawl_loremflickr(args: argparse.Namespace) -> None:
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = output_dir / "metadata.jsonl"

    downloaded = 0
    start = int(time.time())

    with metadata_path.open("a", encoding="utf-8") as metadata_file:
        for index in range(args.count):
            seed = start + index
            source_url = f"{LOREMFLICKR_URL}?lock={seed}"
            filename = f"hairstyle_loremflickr_{seed}.jpg"
            path = output_dir / filename

            try:
                if not path.exists():
                    path.write_bytes(download_bytes(source_url, args.timeout))
            except (HTTPError, URLError, TimeoutError) as exc:
                safe_print(f"  download failed: {source_url} - {exc}")
                continue

            record = {
                "query": "hair,hairstyle,model",
                "title": filename,
                "source_url": source_url,
                "description_url": "https://loremflickr.com/",
                "mime": "image/jpeg",
                "width": 768,
                "height": 1024,
                "artist": "",
                "credit": "Downloaded via LoremFlickr random image endpoint",
                "license": "",
                "usage_terms": "Review upstream image rights before production use.",
                "local_path": str(path),
            }
            metadata_file.write(json.dumps(record, ensure_ascii=False) + "\n")
            metadata_file.flush()

            downloaded += 1
            safe_print(f"  saved {downloaded}/{args.count}: {path.name}")
            time.sleep(args.delay)

    safe_print(f"Done. Downloaded {downloaded} new images to {output_dir}")
    safe_print(f"Metadata: {metadata_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download model hairstyle images.")
    parser.add_argument("--output", default="downloads", help="Directory for downloaded images.")
    parser.add_argument("--count", type=int, default=30, help="Number of new images to download.")
    parser.add_argument("--per-query", type=int, default=30, help="Search results to inspect per query.")
    parser.add_argument("--min-width", type=int, default=500, help="Minimum image width.")
    parser.add_argument("--min-height", type=int, default=500, help="Minimum image height.")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between downloads in seconds.")
    parser.add_argument("--timeout", type=int, default=30, help="Network timeout in seconds.")
    parser.add_argument("--query", action="append", help="Custom search query. Can be repeated.")
    parser.add_argument(
        "--source",
        choices=["commons", "loremflickr"],
        default="commons",
        help="Image source to use.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    crawl(parse_args())
