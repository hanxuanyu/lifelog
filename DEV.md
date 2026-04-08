# 开发指南

## 技术栈

### 后端

- **Go 1.26+** — 主语言
- **Gin** — HTTP 框架
- **GORM + SQLite** — ORM 与数据库（纯 Go 实现，无 CGO 依赖）
- **Viper** — 配置管理，支持 YAML 热重载（fsnotify）
- **JWT** — 身份认证（golang-jwt/v5）
- **bcrypt** — 密码哈希（golang.org/x/crypto）
- **Swagger** — API 文档自动生成（swaggo）
- **embed** — 前端静态文件嵌入二进制
- **MCP** — Model Context Protocol 服务端（mark3labs/mcp-go，SSE 传输）
- **slog + lumberjack** — 结构化日志，双输出（控制台 + 文件轮转）

### 前端

- **React 19** + **TypeScript**
- **Vite 8** — 构建工具
- **Tailwind CSS 4** — 样式方案（OKLch 色彩空间）
- **shadcn/ui + Radix UI** — 组件库
- **Recharts** — 图表（饼图、柱状图、面积图、堆叠柱状图）
- **Framer Motion** — 动画
- **Axios** — HTTP 客户端
- **date-fns** — 日期处理
- **MDXEditor** — Markdown 编辑器
- **markdown-it** — Markdown 渲染
- **react-router-dom** — 路由
- **next-themes** — 深浅模式
- **Sonner** — Toast 通知

## 项目结构

```text
lifelog/
├── main.go                    # 入口，嵌入前端、启动服务
├── go.mod / go.sum            # Go 依赖
├── config.yaml                # 配置文件（首次运行自动生成）
├── Makefile                   # 构建脚本
├── LICENSE                    # AGPL-3.0 许可证
├── README.md                  # 项目说明
├── DEV.md                     # 开发指南（本文件）
├── .github/workflows/
│   ├── verify.yaml            # CI：push/PR 时构建验证
│   └── release.yaml           # CI：tag 推送时跨平台发布
├── scripts/
│   ├── build.sh               # 跨平台构建脚本（6 平台）
│   ├── release.sh             # 版本标签创建与推送
│   └── install.sh             # 一键安装/更新/卸载脚本
├── docs/                      # Swagger 文档（自动生成）
├── data/                      # SQLite 数据库目录
├── web/                       # 前端构建产物（嵌入到二进制）
├── internal/
│   ├── config/
│   │   └── config.go          # 配置加载、热重载、读写接口
│   ├── handler/
│   │   ├── auth.go            # 登录、密码设置
│   │   ├── log_entry.go       # 日志 CRUD、时间轴
│   │   ├── category.go        # 分类管理
│   │   ├── statistics.go      # 统计接口（日/周/月/趋势）
│   │   ├── data.go            # 数据导入导出
│   │   ├── settings.go        # 系统设置
│   │   ├── ai.go              # AI 提供商管理与对话
│   │   ├── version.go         # 版本信息与更新检查
│   │   └── router.go          # 路由注册、静态文件服务、SPA fallback
│   ├── middleware/
│   │   └── auth.go            # JWT 认证中间件
│   ├── model/
│   │   ├── log_entry.go       # 日志条目模型（GORM）
│   │   ├── category.go        # 分类与匹配规则模型
│   │   ├── ai.go              # AI 提供商与对话模型
│   │   └── response.go        # 响应 DTO（统计、分页等）
│   ├── repository/
│   │   ├── db.go              # 数据库初始化（AutoMigrate）
│   │   └── log_entry.go       # 数据访问层（查询、分页、范围查询）
│   ├── service/
│   │   ├── auth.go            # 认证逻辑（bcrypt、JWT 生成/验证）
│   │   ├── log_entry.go       # 日志业务逻辑
│   │   ├── category.go        # 分类匹配（fixed/regex，正则缓存）
│   │   ├── statistics.go      # 统计计算（时长、跨天、趋势）
│   │   └── ai.go              # AI 提供商管理与模型调用
│   ├── logger/
│   │   └── logger.go          # 结构化日志（slog + lumberjack 轮转）
│   ├── mcp/
│   │   └── server.go          # MCP 服务端（SSE 传输，5 个工具）
│   ├── util/
│   │   ├── time_parser.go     # 时间格式解析工具
│   │   └── time_parser_test.go
│   └── version/
│       └── version.go         # 版本变量（构建时注入）
└── frontend/
    ├── package.json
    ├── vite.config.ts         # Vite 配置（代理、路径别名、输出到 ../web）
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx           # React 入口
        ├── App.tsx            # 根组件、路由、全局弹窗、顶部导航
        ├── index.css          # 全局样式、主题变量（OKLch）
        ├── api/index.ts       # API 请求封装（Axios）
        ├── types/index.ts     # TypeScript 类型定义
        ├── lib/
        │   ├── utils.ts       # 工具函数（cn 等）
        │   └── category-toast.ts # 分类分配 Toast 提示
        ├── hooks/
        │   ├── use-theme.ts   # 深浅模式管理
        │   ├── use-toast.ts   # Toast 通知
        │   └── use-shortcut.ts # 键盘快捷键（平台自适应显示）
        ├── pages/
        │   ├── HomePage.tsx        # 首页（时间轴 + 日期导航）
        │   ├── StatisticsPage.tsx  # 统计页（日/周/月/趋势）
        │   ├── SettingsPage.tsx    # 设置页
        │   └── LoginPage.tsx       # 登录页
        └── components/
            ├── QuickAddDialog.tsx      # 快速添加/编辑弹窗
            ├── EventForm.tsx           # 事件表单（时间、事项、标签、详情）
            ├── CategoryAssignDialog.tsx # 分类分配弹窗
            ├── LogInput.tsx            # 日志输入组件
            ├── MobileTimePicker.tsx    # 移动端滚轮时间选择器
            ├── MarkdownEditor.tsx      # Markdown 编辑器
            ├── MarkdownRenderer.tsx    # Markdown 渲染器
            ├── timeline/
            │   ├── index.tsx          # 时间轴容器
            │   ├── ListView.tsx       # 时间轴列表（轨道 + 卡片）
            │   ├── EntryCard.tsx      # 事项卡片
            │   ├── RailSvg.tsx        # 时间轴轨道 SVG
            │   ├── CurveSvg.tsx       # 轨道-卡片连接曲线
            │   ├── CardContextMenu.tsx # 卡片右键菜单
            │   ├── shared.ts          # 时间格式化、常量
            │   ├── useCardGestures.ts # 卡片手势交互
            │   └── useRailInteraction.ts # 轨道交互
            ├── statistics/
            │   ├── DateNav.tsx             # 日期导航
            │   ├── CompactCategorySummary.tsx # 分类汇总
            │   ├── EventBarChart.tsx       # 事项时长柱状图
            │   ├── StackedBarChart.tsx     # 每日堆叠柱状图
            │   ├── TrendChart.tsx          # 趋势面积图
            │   ├── TopEventsCard.tsx       # 事项排行
            │   ├── DailyAveragePills.tsx   # 日均统计
            │   ├── CategoryDetailDialog.tsx # 子分类详情弹窗
            │   └── AISummaryChat.tsx       # AI 统计摘要对话
            ├── settings/
            │   ├── AuthConfigCard.tsx      # 认证配置
            │   ├── PasswordCard.tsx        # 密码设置
            │   ├── ServerConfigCard.tsx    # 服务器配置
            │   ├── TimePointModeCard.tsx   # 时间点模式
            │   ├── CategoriesCard.tsx      # 分类管理
            │   ├── ShortcutCard.tsx        # 快捷键设置
            │   ├── DataManagementCard.tsx  # 数据导入导出
            │   ├── MCPServiceCard.tsx      # MCP 服务配置
            │   ├── AIProviderSettings.tsx  # AI 提供商设置
            │   ├── AIProviderDialog.tsx    # AI 提供商编辑弹窗
            │   └── VersionInfoCard.tsx     # 版本信息与更新
            └── ui/                    # shadcn/ui 组件
```

## 开发模式

### 前后端分别启动

```bash
# 终端 1：启动后端
make server

# 终端 2：启动前端开发服务器（Vite HMR）
make web
```

前端开发服务器会将 `/api` 请求代理到 `localhost:8080`。

### 构建命令

| 命令 | 说明 |
| ---- | ---- |
| `make build` | 完整构建（前端 + 后端，当前平台） |
| `make build-web` | 仅构建前端（输出到 `web/`） |
| `make build-server` | 仅构建后端（输出到 `bin/lifelog`） |
| `make build-all` | 跨平台构建（6 个平台，调用 `scripts/build.sh`） |
| `make web` | 启动前端开发服务器 |
| `make server` | 启动后端开发服务器 |
| `make clean` | 清理所有构建产物 |

### 测试

```bash
go test ./...
```

## 架构说明

### 后端分层

```text
HTTP Request
    ↓
Router（路由分组、认证中间件）
    ↓
Handler（参数校验、响应格式化）
    ↓
Service（核心业务逻辑）
    ↓
Repository（数据库 CRUD）    Config（YAML 配置读写）
    ↓                           ↓
SQLite                      config.yaml（fsnotify 热重载）
```

### MCP 服务

Lifelog 内置 MCP（Model Context Protocol）服务端，与主 HTTP 服务并行运行，通过 SSE 传输协议对外提供数据查询能力。

```text
MCP Client（Claude Desktop / Cursor / ...）
    ↓ SSE
MCP Server（mark3labs/mcp-go）
    ↓
Tool Handlers（参数解析、日志记录）
    ↓
Service / Repository / Config（复用后端业务层）
```

启动流程：

1. `main.go` 检查 `config.GetMCPEnabled()`，若启用则在独立 goroutine 中启动
2. 注册 5 个工具（query_logs、get_daily_statistics、get_period_statistics、get_categories、get_event_types）
3. 每个工具调用通过 `withLog` 包装，记录参数和耗时
4. SSE Server 监听配置端口（默认 8081），客户端通过 `/sse` 端点连接

添加新工具：

1. 在 `internal/mcp/server.go` 的 `tools` 切片中添加 `toolDef`
2. 实现对应的 handler 函数，使用 `withLog` 包装
3. handler 内部复用 `service` 或 `repository` 层的现有逻辑

### 前端构建嵌入

前端 `npm run build` 输出到 `web/` 目录，Go 通过 `//go:embed web/*` 将其编译进单一二进制文件。生产部署只需要一个可执行文件 + `config.yaml`。

路由使用 SPA fallback：未匹配的路径返回 `index.html`，由前端 react-router 处理。

### 认证流程

1. 首次使用无密码，通过 `PUT /api/auth/password` 设置密码
2. 登录后返回 JWT Token，前端存储在 `localStorage`
3. 中间件校验 Token，失败返回 401，前端自动清除 Token 跳转登录页
4. 若未设置密码，中间件放行所有请求

### 分类匹配

分类不存储在数据库中，而是在查询时根据 `config.yaml` 中的规则动态匹配：

1. 按分类顺序遍历，每个分类按规则顺序检查
2. `fixed` 规则：精确字符串匹配
3. `regex` 规则：正则表达式匹配（编译后缓存，RWMutex 保护）
4. 首个匹配的规则生效，无匹配则归为「未分类」

修改分类配置后，所有统计数据自动按新规则重新计算。

### 时间点模式

| 模式 | 含义 | 时长计算 |
| ---- | ---- | ---- |
| `end` | 记录时间 = 事件结束时间 | 当前时间 - 上一条时间 |
| `start` | 记录时间 = 事件开始时间 | 下一条时间 - 当前时间 |

- 全局配置 `time_point_mode` 设定默认模式
- 每条日志可单独记录模式，优先级高于全局
- 相邻两条模式不同时标记为「模式边界」（Unknown）
- 支持跨天事项计算（查询前一天末条 / 后一天首条衔接）

### 统计系统

所有统计数据无状态，从原始日志 + 当前分类配置实时计算：

- **日统计**：单日事项时长明细 + 分类汇总
- **周统计**：周一至周日聚合，含事项排行
- **月统计**：整月聚合，含事项排行
- **趋势统计**：日期范围内每天的分类汇总，用于面积图和堆叠柱状图

### 深浅模式

- CSS 变量定义在 `:root`（浅色）和 `.dark`（深色）中，使用 OKLch 色彩空间
- `use-theme` hook 管理状态，持久化到 `localStorage`
- `index.html` 内联脚本在页面加载前立即应用主题，避免闪烁

## API 概览

启动后访问 `http://localhost:8080/swagger/index.html` 查看完整 API 文档。

### 接口列表

| 方法 | 路径 | 说明 | 认证 |
| ---- | ---- | ---- | ---- |
| `POST` | `/api/auth/login` | 登录 | 否 |
| `PUT` | `/api/auth/password` | 设置/修改密码 | 否 |
| `POST` | `/api/logs` | 创建日志 | 是 |
| `GET` | `/api/logs` | 查询日志（分页、筛选） | 是 |
| `GET` | `/api/logs/timeline` | 获取某日时间轴 | 是 |
| `GET` | `/api/logs/event-types` | 获取所有事件类型 | 是 |
| `GET` | `/api/logs/:id` | 获取单条日志 | 是 |
| `PUT` | `/api/logs/:id` | 更新日志 | 是 |
| `DELETE` | `/api/logs/:id` | 删除日志 | 是 |
| `GET` | `/api/categories` | 获取分类配置 | 是 |
| `PUT` | `/api/categories` | 更新分类配置（热重载） | 是 |
| `GET` | `/api/statistics/daily` | 日统计 | 是 |
| `GET` | `/api/statistics/weekly` | 周统计 | 是 |
| `GET` | `/api/statistics/monthly` | 月统计 | 是 |
| `GET` | `/api/statistics/trend` | 趋势统计 | 是 |
| `GET` | `/api/settings` | 获取设置 | 是 |
| `PUT` | `/api/settings` | 更新设置 | 是 |
| `GET` | `/api/data/export` | 导出数据（ZIP） | 是 |
| `POST` | `/api/data/import` | 导入数据（ZIP） | 是 |
| `GET` | `/api/version` | 获取版本信息 | 否 |
| `GET` | `/api/check-update` | 检查更新 | 是 |
| `GET` | `/api/ai/providers` | 获取 AI 提供商列表 | 是 |
| `POST` | `/api/ai/providers` | 添加 AI 提供商 | 是 |
| `PUT` | `/api/ai/providers/:name` | 更新 AI 提供商 | 是 |
| `DELETE` | `/api/ai/providers/:name` | 删除 AI 提供商 | 是 |
| `POST` | `/api/ai/providers/test` | 测试 AI 提供商连接 | 是 |
| `POST` | `/api/ai/models` | 获取 AI 模型列表 | 是 |
| `POST` | `/api/ai/chat` | AI 对话 | 是 |

### MCP 接口（独立端口）

MCP 服务运行在独立端口（默认 8081），通过 SSE 传输协议提供以下工具：

| 工具名 | 说明 |
| ---- | ---- |
| `query_logs` | 查询日志记录（日期、事项类型、关键词筛选） |
| `get_daily_statistics` | 获取某天的分类统计数据 |
| `get_period_statistics` | 获取日期范围内的分类趋势 |
| `get_categories` | 获取所有分类规则 |
| `get_event_types` | 获取所有不重复的事项类型 |

SSE 端点：`http://localhost:8081/sse`

## CI/CD

### verify.yaml

- 触发：push 或 PR 到 main 分支
- 步骤：构建前端 → 构建后端（静态链接）
- 环境：ubuntu-latest

### release.yaml

- 触发：推送 `v*` 格式的 tag
- 步骤：构建前端 → 跨平台编译 6 个二进制 → 打包（tar.gz / zip）→ 创建 GitHub Release
- 产物：`lifelog_linux_amd64.tar.gz`、`lifelog_darwin_arm64.tar.gz`、`lifelog_windows_amd64.zip` 等

### 发布流程

```bash
# 确保在 main 分支，无未提交更改
./scripts/release.sh v0.1.0
```

脚本会验证分支、检查工作区、创建 tag 并推送，触发 release.yaml 自动构建发布。

## 数据库

- 引擎：SQLite（纯 Go 实现，glebarez/sqlite）
- ORM：GORM，启动时 AutoMigrate
- 文件路径：`config.yaml` 中 `server.db_path`，默认 `./data/lifelog.db`
- 索引：`log_date` 字段建立索引，加速时间轴和范围查询

### 表结构

```sql
log_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date      VARCHAR(10) NOT NULL,   -- YYYY-MM-DD
  log_time      VARCHAR(8)  NOT NULL,   -- HH:mm:ss
  event_type    VARCHAR(100) NOT NULL,  -- 事件名称
  detail        TEXT,                    -- Markdown 详情
  time_point_mode VARCHAR(5),           -- "start" / "end" / ""
  created_at    DATETIME,
  updated_at    DATETIME
)
INDEX idx_log_entries_log_date ON log_entries(log_date)
```

## 数据导入导出

### 导出格式（ZIP）

```text
lifelog-export-YYYYMMDD-HHMMSS.zip
├── logs.json      # 全量日志（含 version、exported_at）
└── config.json    # 分类配置 + time_point_mode
```

### 导入选项

| 参数 | 说明 |
| ---- | ---- |
| `merge_logs=true` | 按 (date, time, event_type) 去重合并 |
| `merge_logs=false` | 清空现有日志后全量导入 |
| `import_config=true` | 同时导入分类配置和时间点模式 |

文件大小限制：100MB。
