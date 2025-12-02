#!/bin/bash

# Script to check deployment status on Aliyun server

set -e

CONTAINER_NAME="deploy-your-app"
HOST_PORT="${PORT:-4173}"

echo "🔍 Checking deployment status..."
echo ""

# Check if container is running
echo "📋 Container Status:"
if docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q "$CONTAINER_NAME"; then
  docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "✅ Container is running!"
else
  echo "❌ Container is not running!"
  echo ""
  echo "Checking stopped containers..."
  docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  exit 1
fi

echo ""
echo "📝 Recent Logs (last 20 lines):"
docker logs --tail 20 "$CONTAINER_NAME"

echo ""
echo "🧪 Testing API Endpoint:"
API_URL="http://localhost:${HOST_PORT}/api/v1/projects"
echo "Testing: $API_URL"

if command -v curl &> /dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API is responding (HTTP $HTTP_CODE)"
    echo ""
    echo "📊 API Response:"
    curl -s "$API_URL" | head -c 200
    echo "..."
  else
    echo "❌ API is not responding (HTTP $HTTP_CODE)"
  fi
else
  echo "⚠️  curl not found, skipping API test"
fi

echo ""
echo "🌐 Service URLs:"
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
echo "   Local: http://localhost:${HOST_PORT}"
echo "   Network: http://${SERVER_IP}:${HOST_PORT}"
echo "   API: http://${SERVER_IP}:${HOST_PORT}/api/v1/projects"

echo ""
echo "📊 Container Resource Usage:"
docker stats --no-stream "$CONTAINER_NAME" --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

