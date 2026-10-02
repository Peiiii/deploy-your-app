#!/usr/bin/env bash
set -euo pipefail

image_tar="${1:?Usage: deploy-thumbnails.sh image.tar.gz}"
image_name="gemigo-thumbnail-capture:latest"
container_name="gemigo-thumbnail-capture"
required_env=(CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_D1_DATABASE_ID CLOUDFLARE_D1_API_TOKEN R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME)
env_args=()
for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing thumbnail configuration: $name" >&2
    exit 1
  fi
  # Docker inherits the variable; secrets never appear in process arguments.
  export "$name"
  env_args+=(-e "$name")
done

gzip -dc "$image_tar" | docker load
# Check the candidate's credentials/scan before replacing a running worker.
docker run --rm "${env_args[@]}" "$image_name" python /app/capture-missing-thumbnails.py --check-only
docker rm -f "$container_name" 2>/dev/null || true
docker run -d --name "$container_name" --init --restart unless-stopped \
  --memory=1g --cpus=1 --shm-size=256m \
  --log-opt max-size=10m --log-opt max-file=3 \
  "${env_args[@]}" "$image_name"

# Wait for a real initial cycle, not merely a running container.
for ((attempt=0; attempt<90; attempt++)); do
  if docker exec "$container_name" test -f /tmp/gemigo-thumbnail-last-scan; then
    echo "Thumbnail worker completed its first scan"
    docker logs --tail 35 "$container_name"
    exit 0
  fi
  if [[ "$(docker inspect --format '{{.State.Running}}' "$container_name")" != true ]]; then
    break
  fi
  sleep 5
done
docker logs --tail 35 "$container_name"
echo "Thumbnail worker did not complete its first scan" >&2
exit 1
