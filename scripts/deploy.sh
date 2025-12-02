#!/bin/bash

# Deployment script for Aliyun Lightweight Server
# This script loads the Docker image and restarts the container

set -e

IMAGE_TAR="$1"
IMAGE_NAME="deploy-your-app-server"
CONTAINER_NAME="deploy-your-app"
APP_DIR="/opt/deploy-your-app"
DATA_DIR="/opt/deploy-your-app/data"
# Host port (can be overridden via PORT environment variable)
HOST_PORT="${PORT:-4173}"
# Container internal port (always 4173 as defined in Dockerfile)
CONTAINER_PORT=4173

if [ -z "$IMAGE_TAR" ]; then
  echo "❌ Error: Docker image tar file path is required"
  echo "Usage: $0 <path-to-image.tar.gz>"
  exit 1
fi

echo "🚀 Starting deployment..."
echo "📅 Deployment time: $(date)"
echo "🐳 Docker version: $(docker --version)"

# Create application directory if it doesn't exist
mkdir -p "$APP_DIR"
mkdir -p "$DATA_DIR"

# Stop and remove old container if exists
echo "🛑 Stopping old container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Load Docker image
echo "📦 Loading Docker image..."
gunzip -c "$IMAGE_TAR" | docker load

# Clean up old image (after loading new one to avoid conflicts)
echo "🧹 Cleaning up old image..."
docker images "${IMAGE_NAME}" --format "{{.ID}}" | head -n -1 | xargs -r docker rmi 2>/dev/null || true

# Start new container
echo "🚀 Starting new container..."
echo "   Host port: ${HOST_PORT}"
echo "   Container port: ${CONTAINER_PORT}"
echo "   Image: ${IMAGE_NAME}:latest"

# Check if image exists
if ! docker images "${IMAGE_NAME}:latest" --format "{{.Repository}}:{{.Tag}}" | grep -q "${IMAGE_NAME}:latest"; then
  echo "❌ Error: Docker image ${IMAGE_NAME}:latest not found!"
  echo "Available images:"
  docker images | grep "${IMAGE_NAME}" || echo "No images found"
  exit 1
fi

# Try to start container
CONTAINER_ID=$(docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${DATA_DIR}:/data" \
  -e NODE_ENV=production \
  -e DATA_DIR=/data \
  -e PORT=${CONTAINER_PORT} \
  "${IMAGE_NAME}:latest" 2>&1) || {
  echo "❌ Failed to start container!"
  echo "Error: $CONTAINER_ID"
  exit 1
}

echo "✅ Container started with ID: ${CONTAINER_ID}"

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Check container status
echo ""
echo "🔍 Checking container status..."
if docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
  echo "✅ Container is running!"
  echo ""
  echo "📋 Container status:"
  docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "📝 Recent logs:"
  docker logs --tail 20 "$CONTAINER_NAME" 2>&1
  echo ""
  echo "✅ Deployment completed successfully!"
  echo ""
  SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
  echo "🌐 Service URL: http://${SERVER_IP}:${HOST_PORT}"
  echo "📊 API endpoint: http://${SERVER_IP}:${HOST_PORT}/api/v1/projects"
else
  echo "❌ Container failed to start or does not exist!"
  echo ""
  echo "📋 Checking if container exists (stopped):"
  if docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo "Container exists but is not running:"
    docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📝 Container exit code:"
    docker inspect "$CONTAINER_NAME" --format='{{.State.ExitCode}}' 2>/dev/null || echo "Unknown"
    echo ""
    echo "📝 Container logs (last 50 lines):"
    docker logs --tail 50 "$CONTAINER_NAME" 2>&1 || echo "Failed to get logs"
    echo ""
    echo "🔍 Container state details:"
    docker inspect "$CONTAINER_NAME" --format='State: {{.State.Status}}, ExitCode: {{.State.ExitCode}}, Error: {{.State.Error}}' 2>/dev/null || echo "Failed to inspect"
  else
    echo "Container does not exist at all!"
    echo ""
    echo "📋 Checking Docker images:"
    docker images | grep "$IMAGE_NAME" || echo "No images found for $IMAGE_NAME"
    echo ""
    echo "📋 All containers:"
    docker ps -a
  fi
  echo ""
  echo "🔍 Checking port availability:"
  netstat -tulpn 2>/dev/null | grep ":${HOST_PORT} " || ss -tulpn 2>/dev/null | grep ":${HOST_PORT} " || echo "Port ${HOST_PORT} appears to be available"
  exit 1
fi

