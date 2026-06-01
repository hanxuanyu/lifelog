#!/usr/bin/env bash
#
# Lifelog 多平台构建脚本。
#
# 用途：
#   构建前端静态资源，并将 Go 服务端交叉编译为多个平台的发布二进制，
#   产物输出到 ./bin。
#
# 用法：
#   ./scripts/build.sh
#   ./scripts/build.sh --skip-frontend
#
# 行为：
#   - 默认在 ./frontend 中执行 `npm install --silent && npm run build`。
#   - 传入 --skip-frontend 时跳过前端构建，适合 CI 已单独构建前端的场景。
#   - 从最新 Git tag 和当前 commit 注入版本信息。
#   - 使用 CGO_ENABLED=0 构建 Linux、macOS、Windows 的 amd64/arm64 二进制。
#
# 依赖：
#   - git、Go、Node.js、npm
#   - 可从任意目录执行，脚本会自动切换到项目根目录。
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

BIN_DIR="$PROJECT_ROOT/bin"
APP_NAME="lifelog"

# Target platforms: OS/ARCH
PLATFORMS=(
  "linux/amd64"
  "linux/arm64"
  "darwin/amd64"
  "darwin/arm64"
  "windows/amd64"
  "windows/arm64"
)

# Build flags: static linking, strip debug info, inject version
VERSION_PKG="github.com/hxuanyu/lifelog/internal/version"
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")
LDFLAGS="-s -w -X ${VERSION_PKG}.Version=${GIT_TAG} -X ${VERSION_PKG}.CommitHash=${GIT_COMMIT}"

# Skip frontend build if --skip-frontend is passed (CI builds frontend separately)
SKIP_FRONTEND=false
for arg in "$@"; do
  if [ "$arg" = "--skip-frontend" ]; then
    SKIP_FRONTEND=true
  fi
done

if [ "$SKIP_FRONTEND" = false ]; then
  echo "==> Building frontend..."
  (cd frontend && npm install --silent && npm run build)
fi

echo "==> Cross-compiling Go binaries..."
for platform in "${PLATFORMS[@]}"; do
  GOOS="${platform%/*}"
  GOARCH="${platform#*/}"

  output_dir="${BIN_DIR}/${APP_NAME}_${GOOS}_${GOARCH}"
  output="${output_dir}/${APP_NAME}"
  if [ "$GOOS" = "windows" ]; then
    output="${output}.exe"
  fi

  mkdir -p "$output_dir"

  echo "    ${GOOS}/${GOARCH} -> ${output_dir}/"
  CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
    go build -trimpath -ldflags "$LDFLAGS" -o "$output" .
done

echo "==> Done. Binaries:"
find "$BIN_DIR" -type f | sort
