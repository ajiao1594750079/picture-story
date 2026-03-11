import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json

from services.ai_service import analyze_image, generate_essay
from services.tts_service import generate_audio
from services.video_service import create_video
from services.wan_video_service import create_wan_video

app = FastAPI(title="看图说话 API")

# Allow localhost for dev; extend via ALLOW_ORIGIN env var (comma-separated) for production
_extra = [o.strip() for o in os.getenv("ALLOW_ORIGIN", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"] + _extra,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Serve frontend build (present in production Docker image, absent in local dev)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend-assets")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@app.get("/", include_in_schema=False)
async def root():
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "看图说话 API is running"}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    """
    Upload an image, get back dynamically generated guiding questions with options.
    """
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {image.content_type}. Supported: {ALLOWED_CONTENT_TYPES}"
        )

    image_bytes = await image.read()

    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="Image too large. Max size is 10MB.")

    try:
        questions = await analyze_image(image_bytes, image.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

    return {"questions": questions}


@app.post("/tts")
async def tts(text: str = Form(...)):
    """Generate TTS audio for short text (questions / options). Returns audio URL."""
    try:
        audio_filename = await generate_audio(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"audio_url": f"/static/{audio_filename}"}


@app.post("/generate-essay")
async def essay(
    image: UploadFile = File(...),
    answers: str = Form(...)
):
    """
    Upload image + answers JSON string, get back an essay.
    answers: JSON array of {"question": str, "selected_option": str}
    """
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type.")

    image_bytes = await image.read()

    try:
        answers_list = json.loads(answers)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid answers JSON format.")

    try:
        essay_text = await generate_essay(image_bytes, image.content_type, answers_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Essay generation failed: {str(e)}")

    return {"essay": essay_text}


# In-memory task store: task_id → {"status": "pending"|"done"|"error", ...}
_tasks: dict = {}


async def _run_video(task_id: str, image_bytes: bytes, content_type: str, essay_text: str):
    """Background task: generate TTS + video, update _tasks when done."""
    try:
        audio_filename = await generate_audio(essay_text)
        try:
            video_filename = await create_wan_video(image_bytes, audio_filename, essay_text, content_type)
        except Exception as wan_err:
            print(f"[DOUBAO VIDEO FAILED] {wan_err}", flush=True)
            video_filename = await create_video(image_bytes, audio_filename)
        _tasks[task_id] = {
            "status": "done",
            "video_url": f"/static/{video_filename}",
            "audio_url": f"/static/{audio_filename}",
        }
    except Exception as e:
        _tasks[task_id] = {"status": "error", "detail": str(e)}


@app.post("/generate-video")
async def video(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    essay_text: str = Form(...)
):
    """
    Submit video generation job. Returns task_id immediately.
    Poll GET /task/{task_id} for status.
    """
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type.")

    if not essay_text or not essay_text.strip():
        raise HTTPException(status_code=400, detail="Essay text cannot be empty.")

    image_bytes = await image.read()
    task_id = uuid.uuid4().hex
    _tasks[task_id] = {"status": "pending"}
    background_tasks.add_task(_run_video, task_id, image_bytes, image.content_type, essay_text)
    return {"task_id": task_id}


@app.get("/task/{task_id}")
async def get_task(task_id: str):
    """Poll video generation task status."""
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
