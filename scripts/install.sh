#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Lifelog 安装/更新/卸载脚本
# 用法:
#   安装或更新(latest):  sudo bash install.sh
#   安装指定版本:        sudo bash install.sh v0.0.3
#   卸载:               sudo bash install.sh --uninstall
# ============================================================

APP_NAME="lifelog"
INSTALL_DIR="/opt/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
SERVICE_USER="lifelog"
REPO="hanxuanyu/lifelog"
DATA_DIR="${INSTALL_DIR}/data"
LOG_DIR="${INSTALL_DIR}/logs"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*" >&2; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# --- Root check ---
[[ $EUID -eq 0 ]] || error "请使用 sudo 或 root 用户运行此脚本"

# --- Detect OS/ARCH --- (sets DETECTED_PLATFORM)
detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$arch" in
    x86_64)  arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) error "不支持的架构: $arch" ;;
  esac
  case "$os" in
    linux) ;;
    darwin) ;;
    *) error "不支持的操作系统: $os" ;;
  esac
  DETECTED_PLATFORM="${os}/${arch}"
}

# --- Uninstall ---
do_uninstall() {
  info "正在卸载 ${APP_NAME}..."
  if systemctl is-active --quiet "${APP_NAME}" 2>/dev/null; then
    systemctl stop "${APP_NAME}"
  fi
  if systemctl is-enabled --quiet "${APP_NAME}" 2>/dev/null; then
    systemctl disable "${APP_NAME}"
  fi
  rm -f "${SERVICE_FILE}"
  systemctl daemon-reload
  # 保留数据目录，只删除二进制
  rm -f "${INSTALL_DIR}/${APP_NAME}"
  info "已卸载。数据目录 ${DATA_DIR} 已保留，如需彻底删除请手动执行: rm -rf ${INSTALL_DIR}"
}

# --- Resolve version --- (sets RESOLVED_VERSION)
resolve_version() {
  local ver="${1:-}"
  if [[ -z "$ver" ]]; then
    info "正在获取最新版本..."
    ver=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" </dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    [[ -n "$ver" ]] || error "无法获取最新版本号"
  fi
  RESOLVED_VERSION="$ver"
}

# --- Download and extract ---
download_and_extract() {
  local ver="$1" platform="$2"
  local os="${platform%/*}" arch="${platform#*/}"
  local archive_name="${APP_NAME}_${os}_${arch}.tar.gz"
  local url="https://github.com/${REPO}/releases/download/${ver}/${archive_name}"
  local tmp_dir
  tmp_dir=$(mktemp -d)

  info "正在下载 ${url}..."
  curl -fSL -o "${tmp_dir}/${archive_name}" "$url" || error "下载失败: ${url}"

  info "正在解压..."
  tar -xzf "${tmp_dir}/${archive_name}" -C "${tmp_dir}"

  # 查找解压后的二进制
  local bin_path
  bin_path=$(find "${tmp_dir}" -name "${APP_NAME}" -type f | head -1)
  [[ -n "$bin_path" ]] || error "解压后未找到 ${APP_NAME} 二进制文件"

  mkdir -p "${INSTALL_DIR}"
  cp -f "$bin_path" "${INSTALL_DIR}/${APP_NAME}"
  chmod +x "${INSTALL_DIR}/${APP_NAME}"

  rm -rf "${tmp_dir}"
  info "二进制已安装到 ${INSTALL_DIR}/${APP_NAME}"
}

# --- Create system user ---
ensure_user() {
  if ! id "${SERVICE_USER}" &>/dev/null; then
    info "创建系统用户 ${SERVICE_USER}..."
    useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
  fi
}

# --- Create systemd unit ---
install_service() {
  info "创建 systemd 服务..."
  cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Lifelog - 无压力每日事项记录
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${APP_NAME}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "${APP_NAME}"
}

# --- Fix permissions ---
fix_permissions() {
  mkdir -p "${DATA_DIR}" "${LOG_DIR}"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
}

# --- Main ---
main() {
  local arg="${1:-}"

  # 卸载模式
  if [[ "$arg" == "--uninstall" ]]; then
    do_uninstall
    exit 0
  fi

  local platform
  detect_platform
  platform="$DETECTED_PLATFORM"
  info "检测到平台: ${platform}"

  local version
  resolve_version "$arg"
  version="$RESOLVED_VERSION"
  info "目标版本: ${version}"

  # 判断是否已部署（更新模式）
  local is_update=false
  if [[ -f "${INSTALL_DIR}/${APP_NAME}" ]]; then
    is_update=true
    info "检测到已有安装，执行更新..."
    if systemctl is-active --quiet "${APP_NAME}" 2>/dev/null; then
      info "停止服务..."
      systemctl stop "${APP_NAME}"
    fi
  fi

  download_and_extract "$version" "$platform"

  if [[ "$is_update" == false ]]; then
    ensure_user
    install_service
  fi

  fix_permissions

  info "启动服务..."
  systemctl start "${APP_NAME}"

  if [[ "$is_update" == true ]]; then
    info "更新完成! 当前版本: ${version}"
  else
    info "安装完成! 服务已启动"
    info "  访问地址: http://localhost:8080"
    info "  查看日志: journalctl -u ${APP_NAME} -f"
    info "  服务管理: systemctl {start|stop|restart|status} ${APP_NAME}"
  fi
}

main "$@"
