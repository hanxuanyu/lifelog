#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE="$PROJECT_ROOT/.env"
COMPOSE_FILE="docker-compose-local.yaml"
CLEAN_SCRIPT="$PROJECT_ROOT/scripts/docker-local-clean-images.sh"
BUILD_PROGRESS="${DOCKER_BUILD_PROGRESS:-plain}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed"
    exit 1
  fi
}

sanitize_docker_tag() {
  printf '%s' "$1" | tr '/:@ ' '-' | tr -cd '[:alnum:]_.-'
}

resolve_pull_target() {
  local branch="$1"
  local upstream remote ref

  if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    remote="${upstream%%/*}"
    ref="${upstream#*/}"
    echo "${remote}:${ref}"
    return 0
  fi

  if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    echo "origin:${branch}"
    return 0
  fi

  return 1
}

update_current_branch() {
  local branch="$1"
  local pull_target remote ref

  if ! pull_target="$(resolve_pull_target "$branch")"; then
    echo "==> No upstream branch found for '$branch'; skipping git pull and using local HEAD."
    return 0
  fi

  remote="${pull_target%%:*}"
  ref="${pull_target#*:}"

  echo "==> Fetching latest '${ref}' from '${remote}'..."
  git fetch "$remote" "$ref"

  echo "==> Pulling latest '${ref}' with fast-forward only..."
  git pull --ff-only "$remote" "$ref"
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
if [ "$BRANCH" = "HEAD" ]; then
  echo "Error: detached HEAD is not supported, please switch to a branch first"
  exit 1
fi

echo "==> Current branch: ${BRANCH}"
update_current_branch "$BRANCH"

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
DEFAULT_IMAGE_TAG="$(sanitize_docker_tag "$BRANCH")"
if [ -z "$DEFAULT_IMAGE_TAG" ]; then
  DEFAULT_IMAGE_TAG="local"
fi

export LIFELOG_LOCAL_IMAGE_REPO="${LIFELOG_LOCAL_IMAGE_REPO:-lifelog-local}"
export LIFELOG_IMAGE_TAG="${LIFELOG_IMAGE_TAG:-$DEFAULT_IMAGE_TAG}"
export LIFELOG_VERSION="${LIFELOG_VERSION:-$BRANCH}"
export LIFELOG_COMMIT="${LIFELOG_COMMIT:-$GIT_COMMIT}"
export LIFELOG_BUILD_NPM_REGISTRY="${LIFELOG_BUILD_NPM_REGISTRY:-}"
export LIFELOG_BUILD_GO_PROXY="${LIFELOG_BUILD_GO_PROXY:-}"

echo "==> Using image tag: ${LIFELOG_IMAGE_TAG}"
echo "==> Injecting version: ${LIFELOG_VERSION}"
echo "==> Injecting commit: ${LIFELOG_COMMIT}"
echo "==> Building local Docker image ${LIFELOG_LOCAL_IMAGE_REPO}:${LIFELOG_IMAGE_TAG}..."
echo "==> Docker build progress mode: ${BUILD_PROGRESS}"
if [ -n "$LIFELOG_BUILD_NPM_REGISTRY" ]; then
  echo "==> Using custom npm registry: ${LIFELOG_BUILD_NPM_REGISTRY}"
fi
if [ -n "$LIFELOG_BUILD_GO_PROXY" ]; then
  echo "==> Using custom Go proxy: ${LIFELOG_BUILD_GO_PROXY}"
fi
docker compose -f "$COMPOSE_FILE" build --pull --progress "$BUILD_PROGRESS" lifelog

echo "==> Restarting local Docker stack..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans lifelog

echo "==> Cleaning historical local Docker images..."
bash "$CLEAN_SCRIPT"

echo "==> Current service status:"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Recent service logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=100 lifelog
