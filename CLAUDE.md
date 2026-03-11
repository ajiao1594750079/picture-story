# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"看图说话" (Picture Story) — a children's web app that helps primary school kids practice describing pictures. User uploads an image → AI generates guiding questions with multiple-choice options → kid answers → AI writes an essay → TTS audio + FFmpeg video are produced.

## Dev Commands

**Backend** (Python 3.9+, FastAPI):
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload        # runs on http://localhost:8000
```

**Frontend** (React + Vite):
```bash
cd frontend
npm run dev                      # runs on http://localhost:5173
npm run build                    # production build to dist/
```

**Install deps from scratch:**
```bash
# Backend
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

**System dependency:** `ffmpeg` must be installed (`brew install ffmpeg`) for video generation.

**No tests or linters are configured** — there are no test files, no pytest/ruff in requirements, and no lint/test scripts in package.json.

## Architecture

```
browser (port 5173)
  └── Vite dev proxy → backend (port 8000)
        ├── POST /analyze          image → AI vision → questions JSON
        ├── POST /generate-essay   image + answers → AI text → essay
        └── POST /generate-video   image + essay → TTS MP3 → FFmpeg MP4
              └── GET /static/{file}   serves generated audio/video files
```

Frontend state machine in `App.jsx`: `upload → quiz → loading → result`

The image file is held in React state and re-sent on each API call (no server-side session).

## Key Configuration

`.env` at repo root (loaded by `backend/main.py` via `python-dotenv`):
```
ANTHROPIC_API_KEY=...
```

CORS is locked to `localhost:5173`. Change `allow_origins` in `main.py` when deploying.

Generated audio/video files accumulate in `backend/static/` — there is no cleanup mechanism.

## AI Services (`backend/services/`)

| File | Responsibility | Current provider |
|------|---------------|-----------------|
| `ai_service.py` | Image analysis + essay generation | Anthropic SDK (`AsyncAnthropic`), model `claude-opus-4-5-20251101` |
| `tts_service.py` | Text-to-speech → MP3 | Microsoft Edge TTS (`edge-tts`, free, no key), voice `zh-CN-XiaoxiaoNeural` |
| `video_service.py` | Image + audio → MP4 | FFmpeg via `ffmpeg-python` (runs in thread pool via `run_in_executor`) |

**Switching AI provider** only requires changing `ai_service.py` — update the client instantiation and `client.messages.create(...)` call. The model must support vision (base64 image input). TTS is provider-independent.

**Image format sent to AI:** base64-encoded inline in message content; `content_type` is forwarded from the upload. Accepted upload types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`; max 10 MB (validated in `main.py`).

**Video pipeline:** uploaded image is converted to RGB JPEG, letterboxed to 1280×720 with black bars, saved as a temp file in `backend/static/`, then combined with the MP3 via FFmpeg (`libx264`/`aac`). The temp image is deleted after encoding.

## Frontend Components

- `App.jsx` — owns all state; drives the upload → quiz → loading → result flow
- `QuestionCard.jsx` — auto-reads question aloud on mount (Web Speech API `zh-CN`); first option click reads it aloud + highlights, second click on same option confirms; question and options are generated fresh per image by the AI (4–5 questions, 3 options each)
- `EssayDisplay.jsx` / `VideoPlayer.jsx` — display-only, shown in result stage
- `index.css` — defines `.btn-kids` and `.card-kids` Tailwind component classes used throughout
