"""Local VoxCPM2 FastAPI wrapper for OpenMAIC.

Run on Windows with:
    python -m uvicorn voxcpm_python_api_server:app --host 127.0.0.1 --port 8000

OpenMAIC configuration:
    Backend: Python API
    Base URL: http://localhost:8000/v1
"""

from __future__ import annotations

import os
import tempfile
import threading
from io import BytesIO
from pathlib import Path
from typing import Optional

import soundfile as sf
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import Response
from voxcpm import VoxCPM


MODEL_ID = os.environ.get("VOXCPM_MODEL_ID", "openbmb/VoxCPM2")
LOAD_DENOISER = os.environ.get("VOXCPM_LOAD_DENOISER", "false").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
DEVICE = os.environ.get("VOXCPM_DEVICE") or None
OPTIMIZE = os.environ.get("VOXCPM_OPTIMIZE", "true").lower() not in {
    "0",
    "false",
    "no",
    "off",
}


app = FastAPI(title="OpenMAIC VoxCPM2 Python API")
_generation_lock = threading.Lock()


model = VoxCPM.from_pretrained(
    MODEL_ID,
    load_denoiser=LOAD_DENOISER,
    device=DEVICE,
    optimize=OPTIMIZE,
)


async def save_upload(upload: Optional[UploadFile]) -> Optional[str]:
    if upload is None:
        return None

    suffix = Path(upload.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(await upload.read())
        return handle.name


def remove_temp_files(*paths: Optional[str]) -> None:
    for path in paths:
        if not path:
            continue
        try:
            os.remove(path)
        except FileNotFoundError:
            pass


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_ID}


@app.post("/v1/tts/upload")
@app.post("/tts/upload")
async def tts_upload(
    text: str = Form(...),
    cfg_value: float = Form(2.0),
    inference_timesteps: int = Form(10),
    normalize: bool = Form(False),
    denoise: bool = Form(False),
    reference_audio: Optional[UploadFile] = File(None),
    prompt_audio: Optional[UploadFile] = File(None),
    prompt_text: Optional[str] = Form(None),
) -> Response:
    reference_path = await save_upload(reference_audio)
    prompt_path = await save_upload(prompt_audio)

    try:
        generate_kwargs: dict[str, object] = {
            "text": text,
            "cfg_value": cfg_value,
            "inference_timesteps": inference_timesteps,
        }

        if reference_path:
            generate_kwargs["reference_wav_path"] = reference_path
        if prompt_path and prompt_text and prompt_text.strip():
            generate_kwargs["prompt_wav_path"] = prompt_path
            generate_kwargs["prompt_text"] = prompt_text.strip()

        # Accepted for OpenMAIC protocol compatibility. The current VoxCPM2
        # Python API does not expose normalize/denoise as per-request options.
        _ = normalize, denoise

        with _generation_lock:
            wav = model.generate(**generate_kwargs)

        audio = BytesIO()
        sf.write(audio, wav, model.tts_model.sample_rate, format="WAV")
        return Response(content=audio.getvalue(), media_type="audio/wav")
    finally:
        remove_temp_files(reference_path, prompt_path)
