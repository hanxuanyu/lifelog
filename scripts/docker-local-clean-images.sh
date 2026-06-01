#!/usr/bin/env bash
#
# Lifelog 本地 Docker 历史镜像清理脚本。
#
# 用途：
#   清理本地构建流程产生的旧 dangling 镜像，只处理带有 Lifelog 本地构建
#   标签的镜像，并输出当前镜像是否存在以便确认。
#
# 用法：
#   ./scripts/docker-local-clean-images.sh
#
# 环境变量：
#   LIFELOG_LOCAL_IMAGE_REPO   本地镜像仓库名，默认 lifelog-local。
#   LIFELOG_IMAGE_TAG          当前镜像标签，默认 main。
#   LIFELOG_IMAGE_PRUNE_UNTIL  镜像清理年龄阈值，默认 168h。
#
# 行为：
#   - 解析变量前会加载项目根目录下可选的 .env。
#   - 仅对 dangling=true、label=io.lifelog.local-build=true 且超过年龄阈值的
#     镜像执行 `docker image prune`。
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
