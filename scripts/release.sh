#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh v0.0.1
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
