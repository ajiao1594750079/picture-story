import os
import uuid
import base64
import asyncio
import httpx
from pathlib import Path
import ffmpeg

STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

API_KEY = os.getenv("DOUBAO_API_KEY")
BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"


def _loop_video_with_audio(video_src: str, audio_src: str, out: str):
    """Loop video to match audio length, replace audio track with TTS."""
    video_in = ffmpeg.input(video_src, stream_loop=-1)
    audio_in = ffmpeg.input(audio_src)
    (
        ffmpeg
        .output(
            video_in.video,
            audio_in.audio,
            out,
            vcodec="libx264",
            acodec="aac",
            pix_fmt="yuv420p",
            shortest=None,
            movflags="+faststart",
        )
        .overwrite_output()
        .run(quiet=True)
    )


async def _poll(task_id: str, timeout: int = 300) -> str:
    """Poll task until succeeded; return video URL."""
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(timeout // 5):
            await asyncio.sleep(5)
            r = await client.get(
                f"{BASE_URL}/contents/generations/tasks/{task_id}",
                headers={"Authorization": f"Bearer {API_KEY}"},
            )
            r.raise_for_status()
            data = r.json()
            print(f"[DOUBAO POLL] type={type(data).__name__} data={data}", flush=True)
            if not isinstance(data, dict):
                raise RuntimeError(f"Unexpected poll response: {data!r}")
            status = data.get("status")
            if status == "succeeded":
                content = data.get("content", {})
                url = content.get("video_url") if isinstance(content, dict) else None
                if url:
                    return url
                raise RuntimeError(f"No video URL in response: {data}")
            if status in ("failed", "canceled"):
                err = data.get("error")
                msg = err.get("message", "") if isinstance(err, dict) else str(err)
                raise RuntimeError(f"Task {status}: {msg}")
    raise TimeoutError("Video generation timed out after 5 minutes")


async def create_wan_video(
    image_bytes: bytes,
    audio_filename: str,
    essay: str,
    content_type: str = "image/jpeg",
) -> str:
    """
    Generate video from image + essay using Doubao Seedance (image-to-video).
    Loops the generated clip to match TTS audio length.
    Returns filename of the final video in STATIC_DIR.
    """
    vid = uuid.uuid4().hex
    audio_path = STATIC_DIR / audio_filename
    tmp_path = STATIC_DIR / f"tmp_{vid}.mp4"
    out_path = STATIC_DIR / f"video_{vid}.mp4"

    # Encode uploaded image as base64 data URL
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    image_data_url = f"data:{content_type};base64,{b64}"

    # Submit image-to-video task
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{BASE_URL}/contents/generations/tasks",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "doubao-seedance-1-5-pro-251215",
                "content": [
                    {"type": "text", "text": essay},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        )
        r.raise_for_status()
        resp = r.json()
        print(f"[DOUBAO CREATE] type={type(resp).__name__} resp={resp}", flush=True)
        task_id = resp["id"]

    # Wait for video (up to 5 minutes)
    video_url = await _poll(task_id)

    # Download generated video
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.get(video_url)
        r.raise_for_status()
        tmp_path.write_bytes(r.content)

    # Loop video to match TTS audio length, replace audio track
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, _loop_video_with_audio,
        str(tmp_path), str(audio_path), str(out_path)
    )
    tmp_path.unlink(missing_ok=True)

    return f"video_{vid}.mp4"
