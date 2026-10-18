import os
import re
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="CleanDrop Media Backend", version="1.0.0")

# Configure exact frontend origin(s), e.g. https://cleandrop.vercel.app
allowed_origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
                 "instagram.com", "www.instagram.com"}
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", str(500 * 1024 * 1024)))
JOBS: dict[str, dict] = {}

class ResolveRequest(BaseModel):
    url: HttpUrl

class DownloadRequest(BaseModel):
    url: HttpUrl
    format_id: str

def validate_url(raw: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail="Use an HTTPS URL from YouTube or Instagram.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs containing credentials are not allowed.")
    return raw

def ydl_options():
    # No browser cookies, account sessions, proxy rotation, or private access.
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "extractor_retries": 1,
        "socket_timeout": 15,
        "cachedir": False,
    }

def human_size(n: Optional[int]) -> str:
    if not n:
        return "Size unknown"
    value = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return "Size unknown"

@app.get("/health")
def health():
    return {"ok": True, "service": "cleandrop-media-backend"}

@app.post("/api/resolve")
def resolve(body: ResolveRequest):
    url = validate_url(str(body.url))
    try:
        with yt_dlp.YoutubeDL(ydl_options()) as ydl:
            info = ydl.extract_info(url, download=False)
       except Exception as e:
        print(f"Resolve failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(
            status_code=422,
            detail="Could not read this link. It may be unavailable, restricted, or unsupported."
        )
    formats = []
    seen = set()
    for f in info.get("formats") or []:
        if f.get("has_drm"):
            continue
        fid = str(f.get("format_id") or "")
        if not fid or not re.fullmatch(r"[A-Za-z0-9._-]{1,40}", fid):
            continue
        height = f.get("height")
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        has_video = bool(vcodec and vcodec != "none")
        has_audio = bool(acodec and acodec != "none")
        if not has_video and not has_audio:
            continue
        # Only expose formats that yt-dlp reports as available. Avoid duplicate IDs.
        key = (fid, f.get("ext"), height, has_video, has_audio)
        if key in seen:
            continue
        seen.add(key)
        if has_video:
            label = f"{height}p" if height else "Video"
            if has_audio:
                label += " · audio included"
            else:
                label += " · video only"
        else:
            label = "Audio only"
        ext = str(f.get("ext") or "media")
        detail = f"{ext.upper()} · {human_size(f.get('filesize') or f.get('filesize_approx'))}"
        if f.get("fps"):
            detail += f" · {int(f['fps'])} fps"
        formats.append({
            "id": fid,
            "label": label,
            "detail": detail,
            "height": height,
            "hasVideo": has_video,
            "hasAudio": has_audio,
            "ext": ext,
        })
    formats.sort(key=lambda x: (x["height"] or 0, x["hasAudio"], x["label"]), reverse=True)
    if not formats:
        raise HTTPException(status_code=422, detail="No downloadable formats were reported for this link.")
    # Format IDs are opaque; download endpoint re-extracts and verifies exact availability.
    return {
        "platform": "Instagram" if "instagram.com" in str(body.url) else "YouTube",
        "title": info.get("title") or "Media",
        "message": "Choose one of the formats reported as available for this link.",
        "formats": formats[:40],
    }

@app.post("/api/download")
def download(body: DownloadRequest):
    url = validate_url(str(body.url))
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,40}", body.format_id):
        raise HTTPException(status_code=400, detail="Invalid format selection.")
    tempdir = tempfile.mkdtemp(prefix="cleandrop-")
    try:
        with yt_dlp.YoutubeDL(ydl_options()) as ydl:
            info = ydl.extract_info(url, download=False)
        available = {str(f.get("format_id")) for f in info.get("formats") or [] if not f.get("has_drm")}
        if body.format_id not in available:
            raise HTTPException(status_code=400, detail="That format is no longer available. Check the link again.")
        opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "cachedir": False,
            "outtmpl": os.path.join(tempdir, "%(title).100B-%(id)s.%(ext)s"),
            "format": body.format_id,
            "max_filesize": MAX_FILE_BYTES,
            "socket_timeout": 20,
            "retries": 1,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        candidates = [p for p in Path(tempdir).iterdir() if p.is_file() and not p.name.endswith((".part", ".ytdl"))]
        if not candidates:
            raise HTTPException(status_code=422, detail="The selected format could not be downloaded as a single file. Try another format.")
        file_path = max(candidates, key=lambda p: p.stat().st_size)
        if file_path.stat().st_size > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds the server's configured size limit.")
        # The temporary file is cleaned after the response is sent.
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/octet-stream",
            background=None,
        )
    except HTTPException:
        shutil.rmtree(tempdir, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(tempdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail="Download failed. This format may need merging or may not be supported by this server.")
