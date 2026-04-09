# Lifelog

无压力的每日事项记录系统。简洁的时间轴界面，快速记录你一天做了什么，可视化统计分析。

单一二进制部署，前端嵌入后端，支持 PWA 安装。

![GitHub Release](https://img.shields.io/github/v/release/hanxuanyu/lifelog)
![Build](https://img.shields.io/github/actions/workflow/status/hanxuanyu/lifelog/verify.yaml?branch=main)
![License](https://img.shields.io/github/license/hanxuanyu/lifelog)
![Go Version](https://img.shields.io/github/go-mod/go-version/hanxuanyu/lifelog)

## 功能亮点

- **极简记录** — 输入时间和事件即可，智能时间解析，事件类型自动补全，支持 Markdown 详情
- **时间轴视图** — 每日事项以时间轴呈现，自动计算持续时长，支持跨天事项
- **数据统计** — 日/周/月统计、趋势分析、分类占比饼图、事项排行、子分类详情
- **分类管理** — 自定义分类与颜色，精确匹配或正则规则，记录时自动归类
- **MCP 集成** — 内置 Model Context Protocol 服务端，AI 助手可直接查询日志数据
- **移动端友好** — 响应式设计，PWA 支持，滚轮式时间选择器，触摸手势操作
- **单文件部署** — 前端嵌入 Go 二进制，只需一个可执行文件 + `config/` 配置目录
- **键盘快捷键** — `←` `→` 切换日期，`T` 回到今天，`Alt+Shift+N` 快速记录
- **深浅模式** — 亮色/暗色主题，自动跟随系统偏好
- **数据导入导出** — ZIP 格式全量备份与恢复

## 快速开始

### 一键安装（Linux / macOS）

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)"
```

安装完成后访问 <http://localhost:8080> 即可使用。

安装指定版本：

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)" -- v0.0.4
```

卸载（保留数据）：

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)" -- --uninstall
```

安装后的常用命令：

```bash
systemctl status lifelog      # 查看服务状态
journalctl -u lifelog -f      # 查看日志
systemctl restart lifelog      # 重启服务
```

> **安装脚本做了什么？** 脚本是开源的，可在运行前[查看完整源码](https://github.com/hanxuanyu/lifelog/blob/main/scripts/install.sh)。它会检测平台架构、从 GitHub Releases 下载二进制、安装到 `/opt/lifelog/`、创建 systemd 服务并启动。更新时仅替换二进制并重启，卸载时保留数据。

### Docker 部署

```bash
# 创建工作目录
mkdir lifelog && cd lifelog

# 下载 docker-compose 配置
curl -fSL -o docker-compose.yaml \
  https://raw.githubusercontent.com/hanxuanyu/lifelog/main/docker-compose.yaml

# 启动服务
docker compose up -d
```

首次启动会自动在 `config/` 目录下生成默认配置文件：`config.yaml`、`categories.yaml`、`webhooks.yaml`。`data/`、`logs/`、`config/` 目录会挂载到宿主机。访问 <http://localhost:8080> 即可使用。

自定义配置：

```bash
# 方式一：通过环境变量覆盖（推荐，编辑 docker-compose.yaml 的 environment 部分）
environment:
  - LIFELOG_SERVER_PORT=8080
  - LIFELOG_AUTH_JWT_SECRET=your-secret-here

# 方式二：直接编辑挂载的配置文件
vim config/config.yaml
vim config/categories.yaml
vim config/webhooks.yaml
docker compose restart
```

常用命令：

```bash
docker compose logs -f     # 查看日志
docker compose restart     # 重启服务
docker compose pull        # 更新镜像
docker compose down        # 停止服务
```

### 手动部署

前往 [GitHub Releases](https://github.com/hanxuanyu/lifelog/releases) 下载对应平台的压缩包：

```bash
# 以 linux/amd64 为例
VERSION="v0.0.4"
curl -fSL -o lifelog.tar.gz \
  "https://github.com/hanxuanyu/lifelog/releases/download/${VERSION}/lifelog_linux_amd64.tar.gz"
tar -xzf lifelog.tar.gz

sudo mkdir -p /opt/lifelog
sudo cp lifelog /opt/lifelog/lifelog
sudo chmod +x /opt/lifelog/lifelog
```

配置 systemd 服务（可选）：

```bash
sudo tee /etc/systemd/system/lifelog.service > /dev/null <<EOF
[Unit]
Description=Lifelog
After=network.target

[Service]
Type=simple
User=lifelog
WorkingDirectory=/opt/lifelog
ExecStart=/opt/lifelog/lifelog
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now lifelog
```

### 从源码构建

前置要求：Go 1.22+、Node.js 18+

```bash
make build          # 完整构建（前端 + 后端），产物在 bin/lifelog
make build-all      # 跨平台构建（6 个平台）
```

首次运行会自动生成 `config/` 下的拆分配置文件和 SQLite 数据库。

## 配置说明

默认会在 `config/` 目录下按功能拆分配置文件：

| 文件 | 说明 | 热重载 |
| ---- | ---- | ------ |
| `config.yaml` | 基础配置：服务端口、数据库路径、认证、时间点模式、AI、MCP | 部分支持 |
| `categories.yaml` | 分类规则配置 | 是 |
| `webhooks.yaml` | Webhook 与事件绑定配置 | 是 |

`config.yaml` 主要配置项：

| 配置项 | 说明 | 默认值 | 热重载 |
| ------ | ---- | ------ | ------ |
| `server.port` | 服务端口 | `8080` | 否 |
| `server.db_path` | 数据库文件路径 | `./data/lifelog.db` | 否 |
| `auth.jwt_secret` | JWT 密钥（建议修改） | `change-me-to-a-random-string` | 否 |
| `auth.jwt_expire_hours` | 登录有效期（小时） | `168`（7 天） | 否 |
| `time_point_mode` | 时间点模式（`start` / `end`） | `end` | 是 |
| `ai.providers` | AI 服务提供商配置 | `[]` | 是 |
| `mcp.enabled` | 启用 MCP 服务 | `false` | 否 |
| `mcp.port` | MCP 服务端口 | `8081` | 否 |

### 环境变量覆盖

基础配置项可通过环境变量覆盖，规则：前缀 `LIFELOG_`，层级用 `_` 分隔，全大写。

| 环境变量 | 对应配置项 |
| -------- | ---------- |
| `LIFELOG_SERVER_PORT` | `server.port` |
| `LIFELOG_SERVER_DB_PATH` | `server.db_path` |
| `LIFELOG_AUTH_JWT_SECRET` | `auth.jwt_secret` |
| `LIFELOG_AUTH_JWT_EXPIRE_HOURS` | `auth.jwt_expire_hours` |
| `LIFELOG_AUTH_PASSWORD_HASH` | `auth.password_hash` |
| `LIFELOG_TIME_POINT_MODE` | `time_point_mode` |
| `LIFELOG_MCP_ENABLED` | `mcp.enabled` |
| `LIFELOG_MCP_PORT` | `mcp.port` |

环境变量优先级高于配置文件，适合 Docker 部署时动态配置。

### 默认分类

| 分类 | 颜色 | 包含事项 |
| ---- | ---- | -------- |
| 工作 | `#3b82f6` | 开会、写文档、编程、沟通、汇报、工单 |
| 成长 | `#10b981` | 学习、阅读、课程、健身、考试 |
| 休息 | `#8b5cf6` | 睡觉、午睡、放松、发呆 |
| 交通 | `#0ea5e9` | 步行、打车、地铁、高铁、飞机、骑车、开车、通勤 |
| 吃喝 | `#f97316` | 早饭、午饭、晚饭、聚餐、下午茶、夜宵 |
| 玩乐 | `#ec4899` | 游戏、视频、追剧、逛街、兴趣活动 |
| 家务 | `#78716c` | 打扫、洗衣、收纳、修理、做饭 |

## MCP 集成

Lifelog 内置 [Model Context Protocol](https://modelcontextprotocol.io/) 服务端，允许 AI 助手直接查询日志数据。

在 `config.yaml` 中启用：

```yaml
mcp:
  enabled: true
  port: 8081
```

可用工具：

| 工具名 | 说明 |
| ------ | ---- |
| `query_logs` | 查询日志（日期、事项类型、关键词筛选） |
| `get_daily_statistics` | 某天的分类统计 |
| `get_period_statistics` | 日期范围内的分类趋势 |
| `get_categories` | 获取所有分类规则 |
| `get_event_types` | 获取所有事项类型 |

客户端配置（Claude Desktop / Cursor）：

```json
{
  "mcpServers": {
    "lifelog": {
      "url": "http://localhost:8081/sse"
    }
  }
}
```

## API 文档

启动后访问 <http://localhost:8080/swagger/index.html> 查看完整 Swagger API 文档。

## 开发指南

详见 [DEV.md](DEV.md)。

## License

本项目采用 [AGPL-3.0](LICENSE) 许可证。任何基于本项目的修改或网络服务均须开源。
