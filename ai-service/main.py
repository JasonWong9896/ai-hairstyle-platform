from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageStat
from openai_image_service import OpenAIImageService
from openrouter_image_service import OpenRouterImageService
from sdxl_service import SDXLService

from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import urlopen
import os
import uuid

BASE_DIR = Path(__file__).resolve().parent
BACKEND_UPLOADS_DIR = BASE_DIR.parent / "backend" / "uploads"
FRONTEND_PUBLIC_DIR = BASE_DIR.parent / "frontend" / "public"
GENERATED_DIR = BASE_DIR / "generated"


def load_env_file():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
IMAGE_PROVIDER = os.getenv("AI_IMAGE_PROVIDER", "local").lower()
AI_SERVICE_PUBLIC_URL = os.getenv("AI_SERVICE_PUBLIC_URL", "http://localhost:9000")
openai_image_service = OpenAIImageService()
openrouter_image_service = OpenRouterImageService()
local_image_service = SDXLService()

app = FastAPI()
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")


class ImageLoadError(ValueError):
    pass


class GenerateRequest(BaseModel):
    customerImage: str | None = None
    styleImage: str | None = None
    userImage: str | None = None
    hairstyleId: int | None = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "imageProvider": IMAGE_PROVIDER,
    }


def describe_hair_color(style_image):
    top_half = style_image.crop((0, 0, style_image.width, style_image.height // 2))
    stat = ImageStat.Stat(top_half.resize((1, 1)))
    red, green, blue = stat.mean

    if max(red, green, blue) < 70:
        return "dark hair"
    if red > green + 25 and red > blue + 25:
        return "warm brown hair"
    if red > 150 and green > 120 and blue < 110:
        return "light brown or blonde hair"
    if blue > red + 20:
        return "cool toned hair"

    return "natural hair color"


def build_prompt(hairstyle_id=None, style_image=None):

    prompts = {
        1: "short Japanese salon hairstyle",
        2: "long wavy salon hairstyle",
        3: "Korean men's salon hairstyle",
    }

    hairstyle = prompts.get(hairstyle_id, "the hairstyle from the reference photo")
    color_hint = describe_hair_color(style_image) if style_image else "natural hair color"

    return (
        "Create one photorealistic salon preview image. Use the first image as the customer identity "
        "reference and preserve the customer's face, facial structure, skin tone, expression, eyes, nose, "
        "and mouth. Use the second image only as the hairstyle reference. Transfer the hairstyle shape, "
        "length, volume, bangs, parting, texture, and overall salon styling from the second image onto "
        f"the customer. Target style: {hairstyle}, {color_hint}. Replace only the hair. Do not copy the "
        "model's face, clothing, background, pose, or body from the second image. Output a single person, "
        "natural hairline, realistic individual hair strands, clean face edges, balanced studio lighting, "
        "no split screen, no before-after collage, no text, no watermark."
    )


def resolve_local_image_path(image_url):
    parsed = urlparse(image_url)
    url_path = unquote(parsed.path).replace("\\", "/")

    if url_path.startswith("/uploads/"):
        return BACKEND_UPLOADS_DIR / Path(url_path).name

    if url_path.startswith("/hairstyles/"):
        return FRONTEND_PUBLIC_DIR / url_path.lstrip("/")

    normalized_url = image_url.replace("\\", "/")
    hairstyles_marker = "/hairstyles/"
    if hairstyles_marker in normalized_url:
        public_path = normalized_url.split(hairstyles_marker, 1)[1]
        return FRONTEND_PUBLIC_DIR / "hairstyles" / public_path

    image_path = Path(image_url)
    if not image_path.is_absolute():
        image_path = (BASE_DIR / image_path).resolve()

    return image_path


def load_image(image_url):
    parsed = urlparse(image_url)

    if parsed.scheme in ("http", "https"):
        local_path = resolve_local_image_path(image_url)
        if local_path.exists():
            return Image.open(local_path).convert("RGB")

        with urlopen(image_url) as response:
            return Image.open(BytesIO(response.read())).convert("RGB")

    image_path = resolve_local_image_path(image_url)

    if not image_path.exists():
        raise ImageLoadError(f"Image file not found: {image_url}")

    return Image.open(image_path).convert("RGB")


def build_generation_base(customer_image, style_image):
    if style_image is None:
        return customer_image

    size = (768, 768)
    base = ImageOps.fit(style_image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.35))
    face = ImageOps.fit(customer_image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))

    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((210, 185, 558, 610), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(28))

    composed = base.copy()
    composed.paste(face, (0, 0), mask)
    return composed


@app.post("/generate")
def generate(req: GenerateRequest):

    print("generate called")

    customer_image_url = req.customerImage or req.userImage
    if not customer_image_url:
        raise HTTPException(status_code=400, detail="customerImage is required")

    try:
        customer_image = load_image(customer_image_url)
        style_image = load_image(req.styleImage) if req.styleImage else None
    except ImageLoadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    prompt = build_prompt(req.hairstyleId, style_image)

    if IMAGE_PROVIDER == "openai":
        try:
            image = openai_image_service.generate(customer_image, style_image, prompt)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    elif IMAGE_PROVIDER == "openrouter":
        try:
            image = openrouter_image_service.generate(customer_image, style_image, prompt)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    else:
        generation_base = build_generation_base(customer_image, style_image)
        image = local_image_service.generate(generation_base, prompt)

    filename = f"{uuid.uuid4()}.png"

    image.save(GENERATED_DIR / filename)

    return {
        "imageUrl":
        f"{AI_SERVICE_PUBLIC_URL}/generated/{filename}"
    }
