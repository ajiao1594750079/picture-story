import os
import uuid
import asyncio
from pathlib import Path
from PIL import Image
import ffmpeg

STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)


async def create_video(image_bytes: bytes, audio_filename: str) -> str:
    """
    Combine a static image + audio file into an MP4 video using FFmpeg.
    Returns the filename of the generated video.
    """
    video_id = uuid.uuid4().hex

    # Save image to a temp file
    image_path = STATIC_DIR / f"img_{video_id}.jpg"
    audio_path = STATIC_DIR / audio_filename
    output_path = STATIC_DIR / f"video_{video_id}.mp4"

    # Ensure image is RGB JPEG (FFmpeg works best with JPEG)
    img = Image.open(image_bytes if hasattr(image_bytes, 'read') else __import__('io').BytesIO(image_bytes))
    img = img.convert("RGB")

    # Resize to a standard resolution (1280x720) maintaining aspect ratio
    img.thumbnail((1280, 720), Image.LANCZOS)
    # Pad to exact 1280x720 with black background
    background = Image.new("RGB", (1280, 720), (0, 0, 0))
    offset = ((1280 - img.width) // 2, (720 - img.height) // 2)
    background.paste(img, offset)
    background.save(str(image_path), "JPEG", quality=95)

    # Run FFmpeg in a thread pool to avoid blocking the event loop
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _run_ffmpeg, str(image_path), str(audio_path), str(output_path))

    # Clean up temp image
    image_path.unlink(missing_ok=True)

    return f"video_{video_id}.mp4"


def _run_ffmpeg(image_path: str, audio_path: str, output_path: str):
    """Synchronous FFmpeg call - runs in thread pool. Ken Burns slow zoom effect."""
    (
        ffmpeg
        .input(image_path, loop=1, framerate=25)
        .output(
            ffmpeg.input(audio_path),
            output_path,
            vcodec="libx264",
            acodec="aac",
            pix_fmt="yuv420p",
            shortest=None,
            movflags="+faststart",
            # Ken Burns: slow zoom-in from 1.0x to 1.3x, centered, cut to audio length
            vf="zoompan=z='min(zoom+0.0003,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=10000:s=1280x720:fps=25"
        )
        .overwrite_output()
        .run(quiet=True)
    )
