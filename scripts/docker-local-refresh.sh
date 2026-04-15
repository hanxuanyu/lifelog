#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="docker-compose-local.yaml"
CLEAN_SCRIPT="$PROJECT_ROOT/scripts/docker-local-clean-images.sh"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed"
    exit 1
  fi
}

require_command git
require_command docker

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose is not available"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Error: ${COMPOSE_FILE} not found"
  exit 1
fi

if [ ! -f "$CLEAN_SCRIPT" ]; then
  echo "Error: cleanup script not found: $CLEAN_SCRIPT"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes or untracked files, please clean it first"
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "==> Switching from '$BRANCH' to 'main'..."
  git switch main
fi

echo "==> Fetching latest main from origin..."
git fetch origin main

echo "==> Pulling latest main with fast-forward only..."
git pull --ff-only origin main

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo dev)"

export LIFELOG_LOCAL_IMAGE_REPO="${LIFELOG_LOCAL_IMAGE_REPO:-lifelog-local}"
export LIFELOG_IMAGE_TAG="${LIFELOG_IMAGE_TAG:-main}"
export LIFELOG_VERSION="${LIFELOG_VERSION:-$GIT_TAG}"
export LIFELOG_COMMIT="${LIFELOG_COMMIT:-$GIT_COMMIT}"

echo "==> Building local Docker image ${LIFELOG_LOCAL_IMAGE_REPO}:${LIFELOG_IMAGE_TAG}..."
docker compose -f "$COMPOSE_FILE" build --pull lifelog

echo "==> Restarting local Docker stack..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans lifelog

echo "==> Cleaning historical local Docker images..."
bash "$CLEAN_SCRIPT"

echo "==> Current service status:"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Recent service logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=100 lifelog
