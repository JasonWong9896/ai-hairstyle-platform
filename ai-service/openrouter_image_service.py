import base64
import json
import os
from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image


OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterImageService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = os.getenv("OPENROUTER_IMAGE_MODEL", "google/gemini-3.1-flash-image-preview")
        self.aspect_ratio = os.getenv("OPENROUTER_IMAGE_ASPECT_RATIO", "1:1")
        self.size = os.getenv("OPENROUTER_IMAGE_SIZE", "1K")
        self.site_url = os.getenv("OPENROUTER_SITE_URL")
        self.app_name = os.getenv("OPENROUTER_APP_NAME", "AI Hairstyle Platform")

    def generate(self, customer_image: Image.Image, style_image: Image.Image | None, prompt: str) -> Image.Image:
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set")

        content = [
            {
                "type": "text",
                "text": (
                    f"{prompt}\n\n"
                    "The first attached image is the customer identity reference. "
                    "The second attached image, when present, is only the hairstyle reference."
                ),
            },
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(customer_image)},
            },
        ]

        if style_image is not None:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_to_data_url(style_image)},
                }
            )

        payload = {
            "model": self.model,
            "modalities": ["image", "text"],
            "messages": [
                {
                    "role": "user",
                    "content": content,
                }
            ],
            "image_config": {
                "aspect_ratio": self.aspect_ratio,
                "size": self.size,
            },
        }

        request = Request(
            OPENROUTER_CHAT_COMPLETIONS_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers=self._headers(),
            method="POST",
        )

        try:
            with urlopen(request, timeout=600) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenRouter image request failed: {exc.code} {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"OpenRouter image request failed: {exc}") from exc

        image_url = first_image_url(response_payload)
        if not image_url:
            raise RuntimeError(f"OpenRouter image response did not include an image: {response_payload}")

        return load_image_url(image_url)

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name

        return headers


def image_to_data_url(image: Image.Image) -> str:
    normalized = image.convert("RGB")
    normalized.thumbnail((1536, 1536))

    buffer = BytesIO()
    normalized.save(buffer, format="PNG", optimize=True)
    image_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{image_b64}"


def first_image_url(payload: dict) -> str | None:
    choices = payload.get("choices") or []
    for choice in choices:
        message = choice.get("message") or {}

        for image in message.get("images") or []:
            image_url = image.get("image_url") or image.get("imageUrl") or {}
            url = image_url.get("url")
            if url:
                return url

        url = first_data_image_url(message.get("content"))
        if url:
            return url

    return first_data_image_url(payload)


def first_data_image_url(value) -> str | None:
    if isinstance(value, str):
        return value if value.startswith(("data:image/", "http://", "https://")) else None

    if isinstance(value, list):
        for item in value:
            url = first_data_image_url(item)
            if url:
                return url

    if isinstance(value, dict):
        for nested in value.values():
            url = first_data_image_url(nested)
            if url:
                return url

    return None


def load_image_url(image_url: str) -> Image.Image:
    if image_url.startswith("data:image/"):
        _, data = image_url.split(",", 1)
        return Image.open(BytesIO(base64.b64decode(data))).convert("RGB")

    with urlopen(image_url, timeout=600) as response:
        return Image.open(BytesIO(response.read())).convert("RGB")
