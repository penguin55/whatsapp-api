#!/bin/sh
set -eu

DOCKERHUB_USER=${DOCKERHUB_USER:-ariutomo}
IMAGE_NAME=${IMAGE_NAME:-wa_gateway_api}
TAG=${TAG:-2.0}
FULL_IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"

echo "Building API image: $FULL_IMAGE"
docker build --pull --tag "$FULL_IMAGE" .

echo "Pushing API image: $FULL_IMAGE"
docker push "$FULL_IMAGE"

echo "Published API image: $FULL_IMAGE"
