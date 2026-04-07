# Lifelog

无压力的每日事项记录系统。通过简洁的时间轴界面，快速记录你一天做了什么，并提供可视化的统计分析。

单一二进制部署，前端嵌入后端，支持 PWA 安装，可添加到手机桌面像原生应用一样使用。

## 功能概览

### 快速记录

- 输入时间和事件即可记录，极简的交互流程
- 智能时间解析，支持多种时间格式（`0830`、`08:30`、`8:30`）
- 事件类型自动补全，基于历史记录和分类规则智能推荐
- 支持 Markdown 格式的详情描述
- 悬浮按钮一键呼出快速记录弹窗，随时随地添加

### 时间轴视图

- 每日事项以时间轴形式直观呈现，左侧轨道显示时间刻度和持续时长色块
- 左右切换日期，日历弹窗快速跳转任意日期
- 自动计算每个事项的持续时长，支持跨天事项
- 支持编辑和删除已有记录
- 键盘快捷键：`←` `→` 切换日期，`T` 回到今天，`/` 聚焦时间输入

### 数据统计

- **日统计**：当日各分类时长占比饼图 + 事项时长柱状图
- **周统计**：一周分类汇总、每日堆叠柱状图、事项排行 Top 10
- **月统计**：整月分类汇总、每日分布图、事项排行 Top 10
- **趋势分析**：按周/月查看每日各分类时长变化面积图、日均统计
- **子分类详情**：点击任意分类，查看该分类下各事项的时长分布
- 所有统计数据无状态，从原始日志实时计算，修改分类配置后自动重新生成

### 分类管理

- 支持自定义事项分类（默认：工作、成长、休息、交通、吃喝、玩乐、家务）
- 每个分类可配置颜色标识
- 灵活的匹配规则：精确匹配（fixed）或正则表达式（regex）
- 事项记录时自动归类，无需手动选择
- 时间轴和统计中以分类颜色直观区分

### 系统设置

- **密码保护**：可设置访问密码，JWT 认证保护隐私
- **时间点模式**：可选择时间点代表事件的开始（start）或结束（end）
- **深浅模式**：支持亮色/暗色主题切换，自动跟随系统偏好
- **分类编辑**：在线增删改分类及其匹配规则
- **数据导入导出**：支持全量日志和配置的 ZIP 格式导入导出
- 配置文件热重载，修改后无需重启

### 移动端体验

- 响应式设计，移动端和桌面端均有良好体验
- PWA 支持，可安装到桌面，支持离线缓存
- 移动端友好的滚轮式时间选择器
- 优化的触摸交互和手势操作

## 快速开始

### 一键安装（Linux / macOS）

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)"
```

安装完成后服务自动启动，访问 <http://localhost:8080> 即可使用。

安装指定版本：

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)" -- v0.0.3
```

卸载（保留数据）：

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/hanxuanyu/lifelog/main/scripts/install.sh)" -- --uninstall
```

安装后的常用命令：

```bash
# 查看服务状态
systemctl status lifelog

# 查看日志
journalctl -u lifelog -f

# 重启服务
systemctl restart lifelog
```

应用内置检查更新功能，可在「设置 → 关于」中一键检查并获取最新版本。

> **安装脚本做了什么？**
>
> 脚本是开源的，你可以在运行前 [查看完整源码](https://github.com/hanxuanyu/lifelog/blob/main/scripts/install.sh)。它执行以下操作：
>
> 1. 检测当前系统平台和 CPU 架构（linux/darwin, amd64/arm64）
> 2. 从 GitHub Releases 下载对应平台的预编译二进制压缩包
> 3. 解压并将二进制文件安装到 `/opt/lifelog/`
> 4. 创建 `lifelog` 系统用户（无登录权限，仅用于运行服务）
> 5. 创建 systemd 服务并设置开机自启
> 6. 创建数据目录 `/opt/lifelog/data` 和日志目录 `/opt/lifelog/logs`
> 7. 启动服务
>
> 更新时仅替换二进制文件并重启服务，不影响已有数据。卸载时保留数据目录，仅移除二进制和服务配置。

### 手动部署

如果你不想使用一键脚本，可以手动完成部署。以下步骤与安装脚本的行为一致。

#### 1. 下载二进制

前往 [GitHub Releases](https://github.com/hanxuanyu/lifelog/releases) 下载对应平台的压缩包，或通过命令行下载：

```bash
# 以 linux/amd64 为例，替换为你的实际平台和版本号
VERSION="v0.0.3"
curl -fSL -o lifelog.tar.gz \
  "https://github.com/hanxuanyu/lifelog/releases/download/${VERSION}/lifelog_linux_amd64.tar.gz"
tar -xzf lifelog.tar.gz
```

#### 2. 安装二进制

```bash
sudo mkdir -p /opt/lifelog
sudo cp lifelog /opt/lifelog/lifelog
sudo chmod +x /opt/lifelog/lifelog
```

#### 3. 创建系统用户和目录

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin lifelog
sudo mkdir -p /opt/lifelog/data /opt/lifelog/logs
sudo chown -R lifelog:lifelog /opt/lifelog
```

#### 4. 配置 systemd 服务

```bash
sudo tee /etc/systemd/system/lifelog.service > /dev/null <<EOF
[Unit]
Description=Lifelog - 无压力每日事项记录
After=network.target

[Service]
Type=simple
User=lifelog
Group=lifelog
WorkingDirectory=/opt/lifelog
ExecStart=/opt/lifelog/lifelog
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

#### 5. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable lifelog
sudo systemctl start lifelog
```

访问 <http://localhost:8080> 即可使用。

#### 手动更新

```bash
sudo systemctl stop lifelog
sudo cp lifelog /opt/lifelog/lifelog
sudo chown lifelog:lifelog /opt/lifelog/lifelog
sudo systemctl start lifelog
```

### 从源码构建

#### 前置要求

- Go 1.22+
- Node.js 18+

### 一键构建

```bash
make build
```

这会自动完成前端编译和后端构建，产物在 `bin/lifelog`。

### 运行

```bash
./bin/lifelog
```

首次运行会自动生成 `config.yaml` 配置文件和 SQLite 数据库。

默认访问地址：http://localhost:8080

### 跨平台构建

```bash
make build-all
```

支持 6 个平台：linux/amd64、linux/arm64、darwin/amd64、darwin/arm64、windows/amd64、windows/arm64。

### 发布

```bash
./scripts/release.sh v0.0.1
```

在 main 分支上创建版本标签并推送，触发 GitHub Actions 自动构建和发布。

## 配置说明

`config.yaml` 主要配置项：

| 配置项 | 说明 | 默认值 | 热重载 |
|--------|------|--------|--------|
| `server.port` | 服务端口 | `8080` | 否 |
| `server.db_path` | 数据库文件路径 | `./data/lifelog.db` | 否 |
| `auth.jwt_secret` | JWT 密钥（建议修改） | `change-me-to-a-random-string` | 否 |
| `auth.jwt_expire_hours` | 登录有效期（小时） | `168`（7天） | 否 |
| `time_point_mode` | 时间点模式（`start` 或 `end`） | `end` | 是 |
| `categories` | 分类规则配置 | 预设 7 个分类 | 是 |
| `mcp.enabled` | 是否启用 MCP 服务 | `false` | 否 |
| `mcp.port` | MCP 服务端口 | `8081` | 否 |

### 默认分类

| 分类 | 颜色 | 包含事项 |
|------|------|----------|
| 工作 | 蓝色 `#3b82f6` | 开会、写文档、编程、沟通、汇报、工单 |
| 成长 | 绿色 `#10b981` | 学习、阅读、课程、健身、考试 |
| 休息 | 紫色 `#8b5cf6` | 睡觉、午睡、放松、发呆 |
| 交通 | 天蓝 `#0ea5e9` | 步行、打车、地铁、高铁、飞机、骑车、开车、通勤 |
| 吃喝 | 橙色 `#f97316` | 早饭、午饭、晚饭、聚餐、下午茶、夜宵 |
| 玩乐 | 粉色 `#ec4899` | 游戏、视频、追剧、逛街、兴趣活动 |
| 家务 | 石灰 `#78716c` | 打扫、洗衣、收纳、修理、做饭 |

## MCP 服务

Lifelog 内置 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务端，允许 AI 助手（如 Claude Desktop、Cursor 等）直接查询你的生活日志数据。

### 启用 MCP

在 `config.yaml` 中开启：

```yaml
mcp:
  enabled: true
  port: 8081
```

重启服务后，MCP 服务将通过 SSE 传输在指定端口启动。

### 可用工具

| 工具名 | 说明 | 主要参数 |
|--------|------|----------|
| `query_logs` | 查询日志记录，支持按日期、事项类型、关键词筛选 | `date`、`start_date`、`end_date`、`event_type`、`keyword`、`page`、`size` |
| `get_daily_statistics` | 获取某天的统计数据，包含各分类时长占比 | `date`（必填） |
| `get_period_statistics` | 获取日期范围内每天的分类统计趋势 | `start_date`、`end_date`（必填） |
| `get_categories` | 获取所有分类规则 | 无 |
| `get_event_types` | 获取所有不重复的事项类型 | 无 |

### 客户端配置

#### Claude Desktop

编辑 Claude Desktop 配置文件（macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "lifelog": {
      "url": "http://localhost:8081/sse"
    }
  }
}
```

#### Cursor

在 Cursor 设置中添加 MCP 服务器，或编辑 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "lifelog": {
      "url": "http://localhost:8081/sse"
    }
  }
}
```

配置完成后，AI 助手即可通过自然语言查询你的日志数据，例如：

- "我今天做了什么？"
- "上周工作时间有多少？"
- "最近一个月的作息趋势如何？"

## API 文档

启动后访问 http://localhost:8080/swagger/index.html 查看完整 Swagger API 文档。

## 开发指南

开发相关说明请参阅 [DEV.md](DEV.md)。
