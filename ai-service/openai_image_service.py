import base64
import json
import os
import uuid
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image


OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits"


class OpenAIImageService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
        self.size = os.getenv("OPENAI_IMAGE_SIZE", "1024x1024")
        self.quality = os.getenv("OPENAI_IMAGE_QUALITY", "high")

    def generate(self, customer_image: Image.Image, style_image: Image.Image | None, prompt: str) -> Image.Image:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        fields = {
            "model": self.model,
            "prompt": prompt,
            "size": self.size,
            "quality": self.quality,
            "n": "1",
        }

        files = [
            ("image[]", "customer.png", image_to_png_bytes(customer_image)),
        ]

        if style_image is not None:
            files.append(("image[]", "style.png", image_to_png_bytes(style_image)))

        body, content_type = encode_multipart(fields, files)
        request = Request(
            OPENAI_IMAGES_EDIT_URL,
            data=body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": content_type,
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=600) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenAI image request failed: {exc.code} {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"OpenAI image request failed: {exc}") from exc

        image_b64 = payload["data"][0]["b64_json"]
        image_bytes = base64.b64decode(image_b64)
        return Image.open(BytesIO(image_bytes)).convert("RGB")


def image_to_png_bytes(image: Image.Image) -> bytes:
    normalized = image.convert("RGB")
    normalized.thumbnail((1536, 1536))

    buffer = BytesIO()
    normalized.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def encode_multipart(fields: dict[str, str], files: list[tuple[str, str, bytes]]) -> tuple[bytes, str]:
    boundary = f"----ai-hairstyle-{uuid.uuid4().hex}"
    lines: list[bytes] = []

    for name, value in fields.items():
        lines.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                f"{value}\r\n".encode("utf-8"),
            ]
        )

    for name, filename, data in files:
        lines.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{Path(filename).name}"\r\n'
                ).encode("utf-8"),
                b"Content-Type: image/png\r\n\r\n",
                data,
                b"\r\n",
            ]
        )

    lines.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(lines), f"multipart/form-data; boundary={boundary}"
