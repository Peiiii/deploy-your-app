# Production thumbnail capture

The `gemigo-thumbnail-capture` Docker container runs the existing
`scripts/capture-missing-thumbnails.py --watch` on the production server. It
scans immediately on startup and waits 60 seconds after each scan. It reads
the latest 50 public Live apps from D1, generates up to 20 missing covers per
cycle in Chromium, and writes the original `apps/<slug>/thumbnail.webp` keys.
Existing covers are preserved; failed apps are logged and retried next cycle.

`.github/workflows/deploy-thumbnails.yml` builds, deploys and verifies this
container independently of the backend. It uses the existing SSH, D1 and R2
repository Secrets and does not replace the backend container. The manual
`capture-thumbnails.yml` workflow remains available for recovery. Stop the
production worker before running recovery if the worker itself is broken.
GitHub `schedule` is no longer used: its events were delayed by several hours.

Operations on the production host:

```bash
docker logs --tail 50 gemigo-thumbnail-capture
docker inspect --format '{{.State.Health.Status}}' gemigo-thumbnail-capture
docker restart gemigo-thumbnail-capture
```

Docker restarts the process/host's container automatically. Health reports a
scanner that has not completed a D1/readiness scan in ten minutes as unhealthy;
one unreachable app does not poison the scanner's health. Health is a signal,
not a Docker restart trigger. Logs rotate at 10 MiB, with three files retained.
The container is limited to one CPU and 1 GiB memory, including Chromium.

Normal light-load capture should finish within two minutes of an accessible
new app appearing in a scan. Slow external resources, a large pending batch,
and unavailable apps can take longer. The frontend already polls pending
central thumbnails and refreshes once ready. Older apps outside the latest 50
are outside the existing automatic scan window.

To roll back, run this deployment workflow at the previous known-good ref.
For an initial-install rollback, stop/remove only `gemigo-thumbnail-capture`
and use the manual recovery workflow. Existing R2 covers remain available.

Regression tests:

```bash
python3 -m unittest discover -s scripts -p 'test_capture_missing_thumbnails.py'
```
