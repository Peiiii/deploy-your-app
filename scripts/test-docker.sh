#!/bin/bash

# Test script for Docker build and run

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="deploy-your-app-server"
CONTAINER_NAME="deploy-your-app-test"

echo "🔨 Building Docker image..."
cd "$PROJECT_ROOT"
docker build -t $IMAGE_NAME .

echo ""
echo "🧹 Cleaning up old container (if exists)..."
docker rm -f $CONTAINER_NAME 2>/dev/null || true

echo ""
echo "🚀 Starting container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p 4173:4173 \
  -v "$PROJECT_ROOT/data:/data" \
  $IMAGE_NAME

echo ""
echo "⏳ Waiting for server to start..."
sleep 3

echo ""
echo "📋 Container status:"
docker ps --filter "name=$CONTAINER_NAME"

echo ""
echo "📝 Container logs:"
docker logs $CONTAINER_NAME

echo ""
echo "🧪 Testing API endpoints..."
echo ""
echo "GET /api/v1/projects:"
curl -s http://localhost:4173/api/v1/projects | jq . || echo "Failed to get projects"

echo ""
echo "✅ Test complete!"
echo ""
echo "To view logs: docker logs -f $CONTAINER_NAME"
echo "To stop: docker stop $CONTAINER_NAME"
echo "To remove: docker rm $CONTAINER_NAME"

