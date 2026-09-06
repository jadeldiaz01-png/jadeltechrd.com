FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN useradd --create-home --uid 10001 appuser
COPY agents.json control_plane.py ./
RUN chown -R appuser:appuser /app
USER 10001:10001

EXPOSE 9090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9090/health/live', timeout=3).read()" || exit 1
CMD ["python", "/app/control_plane.py"]
