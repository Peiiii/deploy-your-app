#!/bin/bash
# Load first, drain jobs, then switch with health-checked rollback.
set -euo pipefail
IMAGE_TAR="${1:-}"
IMAGE_NAME="deploy-your-app-server"
CONTAINER_NAME="deploy-your-app"
PREVIOUS_NAME="${CONTAINER_NAME}-previous"
DATA_DIR="/opt/deploy-your-app/data"
HOST_PORT="${PORT:-80}"
CONTAINER_PORT=4173
if [ ! -f "$IMAGE_TAR" ]; then
  echo 'Deployment image is missing.' >&2
  exit 1
fi
: "${DEPLOY_SERVICE_TOKEN:?Deployment service token must be configured}"
mkdir -p "$DATA_DIR"
gunzip -c "$IMAGE_TAR" | docker load
IMAGE_ID=$(docker image inspect "${IMAGE_NAME}:latest" --format '{{.Id}}')
ENV_ARGS=(-e NODE_ENV=production -e DATA_DIR=/data -e "PORT=$CONTAINER_PORT"
  -e "BUILD_SANDBOX_IMAGE=$IMAGE_ID" -e "BUILD_HOST_DATA_DIR=$DATA_DIR")
OPTIONAL_ENV_VARS=(DEPLOY_SERVICE_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_PAGES_API_TOKEN
  CLOUDFLARE_PAGES_PROJECT_PREFIX DASHSCOPE_API_KEY DEPLOY_TARGET R2_ACCOUNT_ID R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY R2_BUCKET_NAME APPS_ROOT_DOMAIN CLOUDFLARE_D1_DATABASE_ID
  CLOUDFLARE_D1_API_TOKEN STORAGE_TYPE)
for var_name in "${OPTIONAL_ENV_VARS[@]}"; do
  value="${!var_name:-}"
  if [ -n "$value" ]; then ENV_ARGS+=(-e "${var_name}=${value}"); fi
done
# New controllers expose pending jobs; legacy controllers have no health endpoint.
if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  for _ in $(seq 1 120); do
    PENDING=$(docker exec "$CONTAINER_NAME" node -e "fetch('http://localhost:4173/healthz').then(r=>r.ok?r.json():{pending:0}).then(x=>console.log(x.pending||0)).catch(()=>process.exit(1))")
    if [ "$PENDING" = 0 ]; then break; fi
    sleep 5
  done
  if [ "$PENDING" != 0 ]; then echo 'Active deployments did not drain; leaving the current service running.' >&2; exit 1; fi
  docker rm -f "$PREVIOUS_NAME" >/dev/null 2>&1 || true
  docker stop -t 30 "$CONTAINER_NAME"
  docker rename "$CONTAINER_NAME" "$PREVIOUS_NAME"
fi
rollback() {
  echo 'New service did not become healthy; restoring the previous container.' >&2
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  if docker inspect "$PREVIOUS_NAME" >/dev/null 2>&1; then
    docker rename "$PREVIOUS_NAME" "$CONTAINER_NAME"
    docker start "$CONTAINER_NAME"
  fi
}
if ! docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" -v "${DATA_DIR}:/data" \
  -v /var/run/docker.sock:/var/run/docker.sock "${ENV_ARGS[@]}" "$IMAGE_ID"; then
  rollback
  exit 1
fi
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" node -e "fetch('http://localhost:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    docker rm "$PREVIOUS_NAME" >/dev/null 2>&1 || true
    echo 'Deployment health check passed.'
    exit 0
  fi
  sleep 2
done
rollback
exit 1
