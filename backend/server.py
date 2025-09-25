# server.py
import os
from typing import Optional, List, Literal, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl
import fal_client
from dotenv import load_dotenv

# load env (reads .env in the current directory)
load_dotenv()
if not os.getenv("FAL_KEY"):
    raise RuntimeError("FAL_KEY is missing. Put it in your .env")

MODEL_ID = "fal-ai/flux-kontext/dev"

app = FastAPI(title="Kontext Proxy", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- types -----
Acceleration = Literal["none", "regular", "high"]
OutputFormat = Literal["jpeg", "png"]
ResolutionMode = Literal[
    "auto", "match_input",
    "1:1", "16:9", "21:9", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3", "9:16", "9:21"
]

class GenerateRequest(BaseModel):
    prompt: str
    image_url: Optional[HttpUrl] = None
    num_inference_steps: Optional[int] = 28
    seed: Optional[int] = None
    guidance_scale: Optional[float] = 2.5
    num_images: Optional[int] = 1
    enable_safety_checker: Optional[bool] = True
    output_format: Optional[OutputFormat] = "jpeg"
    acceleration: Optional[Acceleration] = "none"
    enhance_prompt: Optional[bool] = False
    resolution_mode: Optional[ResolutionMode] = "match_input"

class ImageOut(BaseModel):
    url: HttpUrl
    width: int
    height: int
    content_type: str
    has_nsfw_concepts: Optional[bool] = None

class GenerateResponse(BaseModel):
    prompt: str
    seed: Optional[int] = None
    images: List[ImageOut]

def call_fal(arguments: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # wait until images are uploaded & ready
        arguments["sync_mode"] = True
        result = fal_client.subscribe(MODEL_ID, arguments=arguments, with_logs=False)
        imgs = result.get("images") or []
        flags = result.get("has_nsfw_concepts")

        out = []
        for i, img in enumerate(imgs):
            out.append({
                "url": img["url"],
                "width": img["width"],
                "height": img["height"],
                "content_type": img.get("content_type", "image/jpeg"),
                "has_nsfw_concepts": (flags[i] if isinstance(flags, list) and i < len(flags) else None)
            })
        return {"prompt": result.get("prompt") or arguments["prompt"],
                "seed": result.get("seed"),
                "images": out}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FAL upstream error: {e}")

@app.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest):
    if not payload.image_url:
        raise HTTPException(status_code=400, detail="Send image_url or use /generate/upload with a file.")
    args = payload.model_dump(exclude_none=True)
    return JSONResponse(call_fal(args))

@app.post("/generate/upload", response_model=GenerateResponse)
async def generate_upload(
    prompt: str = Form(...),
    image_file: UploadFile = File(...),
    num_inference_steps: Optional[int] = Form(28),
    seed: Optional[int] = Form(None),
    guidance_scale: Optional[float] = Form(2.5),
    num_images: Optional[int] = Form(1),
    enable_safety_checker: Optional[bool] = Form(True),
    output_format: Optional[OutputFormat] = Form("jpeg"),
    acceleration: Optional[Acceleration] = Form("none"),
    enhance_prompt: Optional[bool] = Form(False),
    resolution_mode: Optional[ResolutionMode] = Form("match_input"),
):
    try:
        # upload your local file to FAL’s storage
        tmp = f"/tmp/{image_file.filename}"
        with open(tmp, "wb") as f:
            f.write(await image_file.read())
        uploaded_url = fal_client.upload_file(tmp)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {e}")

    args = {
        "prompt": prompt,
        "image_url": uploaded_url,
        "num_inference_steps": num_inference_steps,
        "seed": seed,
        "guidance_scale": guidance_scale,
        "num_images": num_images,
        "enable_safety_checker": enable_safety_checker,
        "output_format": output_format,
        "acceleration": acceleration,
        "enhance_prompt": enhance_prompt,
        "resolution_mode": resolution_mode,
        "sync_mode": True
    }
    return JSONResponse(call_fal(args))
