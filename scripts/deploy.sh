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
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${DATA_DIR}:/data" \
  -e NODE_ENV=production \
  -e DATA_DIR=/data \
  -e PORT=${CONTAINER_PORT} \
  "${IMAGE_NAME}:latest"

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 3

# Check container status
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ Container is running!"
  echo ""
  echo "📋 Container status:"
  docker ps --filter "name=$CONTAINER_NAME"
  echo ""
  echo "📝 Recent logs:"
  docker logs --tail 20 "$CONTAINER_NAME"
  echo ""
  echo "✅ Deployment completed successfully!"
else
  echo "❌ Container failed to start!"
  echo "📝 Error logs:"
  docker logs "$CONTAINER_NAME" || true
  exit 1
fi

