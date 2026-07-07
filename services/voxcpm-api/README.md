# OpenMAIC VoxCPM2 API

This is the production sidecar for OpenMAIC's VoxCPM2 TTS provider.

The main app should use the VoxCPM2 provider with the Python API backend and:

```text
TTS_VOXCPM_BASE_URL=http://voxcpm-api:8000
ALLOW_LOCAL_NETWORKS=true
```

The service stores Hugging Face model cache under `/models`, so mount a volume
there in production. For CUDA builds, pass a PyTorch index URL while building,
for example `TORCH_INDEX_URL=https://download.pytorch.org/whl/cu130`.
