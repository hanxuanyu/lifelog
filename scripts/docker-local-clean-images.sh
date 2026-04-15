#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

IMAGE_REPO="${LIFELOG_LOCAL_IMAGE_REPO:-lifelog-local}"
IMAGE_TAG="${LIFELOG_IMAGE_TAG:-main}"
CURRENT_IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
PRUNE_UNTIL="${LIFELOG_IMAGE_PRUNE_UNTIL:-168h}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is required"
  exit 1
fi

echo "==> Pruning dangling local Docker images older than ${PRUNE_UNTIL}..."
docker image prune -f \
  --filter "label=io.lifelog.local-build=true" \
  --filter "dangling=true" \
  --filter "until=${PRUNE_UNTIL}"

if docker image inspect "$CURRENT_IMAGE" >/dev/null 2>&1; then
  echo "==> Keeping current local image: ${CURRENT_IMAGE}"
else
  echo "==> Current local image not found yet: ${CURRENT_IMAGE}"
fi
