FROM python:3.12-slim-bookworm

WORKDIR /app
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir boto3==1.40.0 Pillow==12.0.0 playwright==1.57.0 \
    && python -m playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/capture-missing-thumbnails.py /app/capture-missing-thumbnails.py

# A scan can include up to twenty bounded navigations. Partial app failures
# still count as a working scanner; failed D1/readiness scans do not.
HEALTHCHECK --interval=60s --timeout=5s --start-period=120s --retries=2 \
    CMD python -c "import pathlib,time; p=pathlib.Path('/tmp/gemigo-thumbnail-last-scan'); assert p.exists() and time.time()-float(p.read_text())<600"

CMD ["python", "/app/capture-missing-thumbnails.py", "--watch"]
