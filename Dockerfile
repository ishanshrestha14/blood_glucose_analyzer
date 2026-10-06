# Backend image: Flask API + PaddleOCR + trained risk model.
# Build from the repo root:  docker build -t glucose-analyzer .
# Run:                       docker run -p 5000:5000 glucose-analyzer
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Shared libraries PaddlePaddle and OpenCV need at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt gunicorn

COPY backend/ backend/
COPY ml_training/ ml_training/

# diabetes_pipeline.pkl is gitignored; train it here so the pickle always
# matches the scikit-learn version installed in this image.
RUN python ml_training/train_model.py

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

WORKDIR /app/backend
EXPOSE 5000

# Railway/Render inject $PORT; default to 5000 locally.
# One worker because each PaddleOCR instance holds its models in memory.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 120 app:app"]
