import uuid
from pathlib import Path
import edge_tts

STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

# 温柔的中文女声，适合儿童
VOICE = "zh-CN-XiaoxiaoNeural"


async def generate_audio(text: str) -> str:
    """
    Convert text to speech using Microsoft Edge TTS (free, no API key needed).
    Returns the filename of the generated MP3.
    """
    filename = f"audio_{uuid.uuid4().hex}.mp3"
    output_path = str(STATIC_DIR / filename)

    communicate = edge_tts.Communicate(text, VOICE, rate="-10%", pitch="+5Hz")
    await communicate.save(output_path)

    return filename
