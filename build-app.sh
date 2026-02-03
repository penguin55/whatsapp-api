#!/bin/bash

set -e  # stop on error

### ===== CONFIG =====
DOCKERHUB_USER="<<USERNAME>>"
IMAGE_NAME="whatsapp_jasindo_api"          # change if needed
TAG="1.0"
FULL_IMAGE="$DOCKERHUB_USER/$IMAGE_NAME:$TAG"
COMPOSE_FILE="docker-compose.yml"
### ==================

echo "🔧 Building Docker image: $FULL_IMAGE"
docker build -t $FULL_IMAGE .

echo "📤 Pushing image to Docker Hub"
docker push $FULL_IMAGE

echo "🧹 Checking for existing containers from compose project..."

# This safely stops and removes containers, networks, and orphans from the compose file
if docker compose -f $COMPOSE_FILE ps -q >/dev/null 2>&1; then
    docker compose -f $COMPOSE_FILE down --remove-orphans
    echo "Old containers removed."
else
    echo "No existing compose containers found."
fi

echo "🚀 Starting docker-compose"
docker compose -f $COMPOSE_FILE up -d --build

echo "✅ Deployment complete!"
