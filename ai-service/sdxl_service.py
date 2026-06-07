import torch
from diffusers import StableDiffusionImg2ImgPipeline
from pathlib import Path


MODEL_CACHE_DIR = Path(r"E:\Projects\monorepo\models\huggingface\hub")


class SDXLService:

    def __init__(self):

        self.pipe = None

    def load_model(self):

        if self.pipe is not None:
            return

        self.pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            cache_dir=MODEL_CACHE_DIR,
            torch_dtype=torch.float32,
            safety_checker=None,
            low_cpu_mem_usage=False,
        )

        self.pipe.enable_attention_slicing()

    def generate(self, init_image, prompt):

        self.load_model()

        init_image.thumbnail((640, 640))
        width = max(512, min(640, (init_image.width // 8) * 8))
        height = max(512, min(640, (init_image.height // 8) * 8))
        init_image = init_image.resize((width, height))

        result = self.pipe(
            prompt=prompt,
            image=init_image,
            negative_prompt=(
                "different person, changed face, extra face, duplicate person, two people, "
                "collage, split screen, deformed face, distorted eyes, bad anatomy, blurry, "
                "low quality, cartoon, painting, watermark, text"
            ),
            strength=0.28,
            guidance_scale=6.5,
            num_inference_steps=28,
        )

        return result.images[0]
