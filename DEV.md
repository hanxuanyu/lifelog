# 开发指南

## 技术栈

### 后端

- **Go** — 主语言
- **Gin** — HTTP 框架
- **GORM + SQLite** — ORM 与数据库
- **Viper** — 配置管理，支持 YAML 热重载
- **JWT** — 身份认证（golang-jwt/v5）
- **Swagger** — API 文档自动生成（swaggo）
- **embed** — 前端静态文件嵌入二进制

### 前端

- **React 19** + **TypeScript**
- **Vite** — 构建工具
- **Tailwind CSS 4** — 样式方案
- **shadcn/ui + Radix UI** — 组件库
- **Framer Motion** — 动画
- **Recharts** — 图表
- **Axios** — HTTP 客户端
- **date-fns** — 日期处理
- **react-markdown** — Markdown 渲染
- **react-router-dom** — 路由

## 项目结构

```
lifelog/
├── main.go                  # 入口，嵌入前端、启动服务
├── config.yaml              # 配置文件（自动生成）
├── Makefile                 # 构建脚本
├── data/                    # SQLite 数据库目录
├── docs/                    # Swagger 文档（自动生成）
├── web/                     # 前端构建产物（嵌入到二进制）
├── internal/
│   ├── config/              # 配置加载与管理
│   ├── handler/             # HTTP 处理器
│   │   ├── auth.go          # 登录、密码设置
│   │   ├── log_entry.go     # 日志 CRUD、时间轴
│   │   ├── category.go      # 分类管理
│   │   └── statistics.go    # 统计接口
│   ├── middleware/
│   │   └── auth.go          # JWT 认证中间件
│   ├── model/
│   │   ├── log_entry.go     # 日志条目模型
│   │   ├── category.go      # 分类模型
│   │   └── response.go      # 统一响应格式
│   ├── repository/
│   │   ├── db.go            # 数据库初始化
│   │   └── log_entry.go     # 日志数据访问层
│   ├── router/
│   │   └── router.go        # 路由注册
│   ├── service/
│   │   ├── auth.go          # 认证业务逻辑
│   │   ├── log_entry.go     # 日志业务逻辑
│   │   ├── category.go      # 分类业务逻辑
│   │   └── statistics.go    # 统计业务逻辑
│   └── util/
│       ├── time_parser.go   # 时间解析工具
│       └── time_parser_test.go
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx           # 根组件、路由、悬浮按钮
        ├── main.tsx          # 入口
        ├── index.css         # 全局样式、主题变量
        ├── api/index.ts      # API 请求封装
        ├── types/index.ts    # TypeScript 类型定义
        ├── hooks/
        │   ├── use-toast.ts  # Toast 通知
        │   └── use-theme.ts  # 深浅模式切换
        ├── pages/
        │   ├── HomePage.tsx       # 首页（时间轴 + 输入）
        │   ├── StatisticsPage.tsx # 统计页
        │   ├── SettingsPage.tsx   # 设置页
        │   └── LoginPage.tsx      # 登录页
        ├── components/
        │   ├── LogInput.tsx           # 日志输入组件
        │   ├── QuickAddDialog.tsx     # 快速添加弹窗
        │   ├── MobileTimePicker.tsx   # 移动端时间选择器
        │   ├── timeline/             # 时间轴组件
        │   └── ui/                   # shadcn/ui 组件
        └── lib/utils.ts              # 工具函数
```

## 开发模式

### 前后端分别启动

```bash
# 终端 1：启动后端（热重载需自行使用 air 等工具）
make server

# 终端 2：启动前端开发服务器（Vite HMR）
make web
```

前端开发服务器会将 `/api` 请求代理到 `localhost:8080`。

### 全量构建

```bash
make build          # 完整构建（前端 + 后端）
make build-web      # 仅构建前端
make build-server   # 仅构建后端
make clean          # 清理所有构建产物
```

## API 概览

启动后访问 http://localhost:8080/swagger/index.html 查看完整 API 文档。

### 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录 |
| `PUT` | `/api/auth/password` | 设置/修改密码 |
| `POST` | `/api/logs` | 创建日志 |
| `GET` | `/api/logs` | 查询日志（分页） |
| `GET` | `/api/logs/timeline` | 获取某日时间轴 |
| `GET` | `/api/logs/event-types` | 获取所有事件类型 |
| `GET/PUT/DELETE` | `/api/logs/:id` | 单条日志操作 |
| `GET` | `/api/categories` | 获取分类配置 |
| `PUT` | `/api/categories` | 更新分类配置 |
| `GET` | `/api/statistics/daily` | 日统计 |
| `GET` | `/api/statistics/weekly` | 周统计 |
| `GET` | `/api/statistics/monthly` | 月统计 |
| `GET` | `/api/settings` | 获取设置 |
| `PUT` | `/api/settings` | 更新设置 |

所有 `/api/logs`、`/api/categories`、`/api/statistics`、`/api/settings` 接口需要 `Authorization: Bearer <token>` 请求头。

## 架构说明

### 后端分层

```
Handler → Service → Repository → SQLite
                  → Config (YAML)
```

- **Handler**：参数校验、响应格式化
- **Service**：核心业务逻辑（时长计算、分类匹配、统计聚合）
- **Repository**：数据库 CRUD
- **Config**：配置读写，支持 `fsnotify` 文件变更监听热重载

### 前端构建嵌入

前端 `npm run build` 输出到 `web/` 目录，Go 通过 `//go:embed web/*` 将其编译进单一二进制文件。生产部署只需要一个可执行文件 + `config.yaml`。

### 认证流程

1. 首次使用无密码，通过 `PUT /api/auth/password` 设置密码
2. 登录后返回 JWT Token，前端存储在 `localStorage`
3. 中间件校验 Token，失败返回 401 自动跳转登录页

### 深浅模式

- CSS 变量定义在 `:root`（浅色）和 `.dark`（深色）中
- `use-theme` hook 管理状态，持久化到 `localStorage`
- `index.html` 内联脚本在页面加载前立即应用主题，避免闪烁
