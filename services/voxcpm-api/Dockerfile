FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    HUGGINGFACE_HUB_CACHE=/models/huggingface/hub \
    VOXCPM_HOST=0.0.0.0 \
    VOXCPM_PORT=8000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    git \
    libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

ARG TORCH_INDEX_URL=
ARG TORCH_PACKAGES="torch torchaudio"
RUN python -m pip install --upgrade pip \
  && if [ -n "$TORCH_INDEX_URL" ]; then \
    python -m pip install --no-cache-dir --index-url "$TORCH_INDEX_URL" $TORCH_PACKAGES; \
  fi \
  && python -m pip install --no-cache-dir -r requirements.txt

COPY app.py ./

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host ${VOXCPM_HOST:-0.0.0.0} --port ${VOXCPM_PORT:-8000}"]
