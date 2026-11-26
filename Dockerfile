# ── Stage 1: Build React frontend ─────────────────────────────────────────
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ ./
ENV REACT_APP_API_URL=""
RUN npm run build


# ── Stage 2: Python backend + serve static frontend ───────────────────────
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Backend source
COPY backend/ ./backend/
COPY training/ ./training/

# Copy built React assets into a location FastAPI can serve
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Artifacts & writable data directories (HF Spaces runs as non-root UID 1000)
RUN mkdir -p artifacts data/uploads && chmod -R 777 data

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Serve static frontend through FastAPI/Uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
