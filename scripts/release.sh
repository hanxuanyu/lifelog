#!/usr/bin/env bash
#
# Lifelog 发布标签辅助脚本。
#
# 用途：
#   创建或更新语义化版本标签，并推送到 origin。推送标签后通常会触发
#   GitHub Actions 中的 release workflow。
#
# 用法：
#   ./scripts/release.sh v0.0.1
#
# 安全检查：
#   - 标签必须符合 v<major>.<minor>.<patch> 格式。
#   - 当前分支必须是 main。
#   - 工作区和暂存区必须干净。
#   - 打标签前会从 origin/main 拉取最新状态。
#
# 注意：
#   - 本地标签会通过 `git tag -f` 重建。
#   - 远端标签会通过 `git push --force` 覆盖，请仅用于明确要发布的版本标签。
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <tag>  (e.g. v0.0.1)"
  exit 1
fi

TAG="$1"

# Validate tag format
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: tag must match v<major>.<minor>.<patch> (e.g. v0.0.1)"
  exit 1
fi

# Must be on main branch
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "Error: current branch is '$BRANCH', must be on 'main'"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes, please commit or stash first"
  exit 1
fi

# Fetch latest and check if up to date
echo "==> Fetching latest from remote..."
git fetch origin main

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "==> Local is behind remote, pulling latest..."
  git pull --rebase origin main
fi

# Create tag (overwrite if exists locally)
echo "==> Creating tag: $TAG"
git tag -f "$TAG"

# Force push tag to remote
echo "==> Pushing tag to remote..."
git push origin "$TAG" --force

echo "==> Done. Tag '$TAG' has been pushed to origin."
