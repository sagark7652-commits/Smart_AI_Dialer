# ==============================================================================
# Production Dockerfile for Core AI Calling Agent Engine
# Optimized for low latency, security (non-root), and audio streaming.
# ==============================================================================

FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    APP_ENV=production

# Install system audio, codec, and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    libportaudio2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and configuration
COPY . .

# Create persistent storage directories with non-root ownership
RUN mkdir -p transcripts recordings knowledge_base \
    && chown -R appuser:appuser /app

# Switch to non-root execution
USER appuser

# Expose internal HTTP & WebSocket port
EXPOSE 8000

# Container health probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Launch ASGI production server with 2 worker processes
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
