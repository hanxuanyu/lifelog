export type SettingsSearchTab = "app-info" | "basic" | "tokens" | "automation" | "categories"

export interface SettingsSearchItem {
  id: string
  title: string
  description: string
  keywords: string[]
  tab: SettingsSearchTab
  section: string
}

export const SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = [
  {
    id: "version-info",
    title: "版本信息",
    description: "查看当前应用版本和构建信息。",
    keywords: ["设置首页", "版本", "升级", "构建", "release"],
    tab: "app-info",
    section: "version-info",
  },
  {
    id: "server-monitor",
    title: "服务监控",
    description: "查看服务状态、资源占用和运行信息。",
    keywords: ["监控", "状态", "CPU", "内存", "服务", "性能"],
    tab: "app-info",
    section: "server-monitor",
  },
  {
    id: "online-devices",
    title: "在线设备",
    description: "查看当前在线的客户端设备，支持远程登出。",
    keywords: ["设备", "在线", "客户端", "登出", "WebSocket", "连接"],
    tab: "app-info",
    section: "online-devices",
  },
  {
    id: "token-management",
    title: "令牌管理",
    description: "管理登录令牌和 API 令牌，支持创建和吊销。",
    keywords: ["令牌", "token", "API", "吊销", "登录", "密钥"],
    tab: "tokens",
    section: "token-management",
  },
  {
    id: "password-settings",
    title: "密码设置",
    description: "修改登录密码。",
    keywords: ["密码", "登录", "认证", "安全", "auth"],
    tab: "app-info",
    section: "password-settings",
  },
  {
    id: "data-management",
    title: "数据管理",
    description: "导入、导出和维护日志数据。",
    keywords: ["导入", "导出", "备份", "恢复", "数据"],
    tab: "app-info",
    section: "data-management",
  },
  {
    id: "shortcut-settings",
    title: "快捷键设置",
    description: "配置快速记录等快捷键。",
    keywords: ["快捷键", "快捷操作", "键盘", "热键", "shortcuts"],
    tab: "app-info",
    section: "shortcut-settings",
  },
  {
    id: "time-point-mode",
    title: "时间点模式",
    description: "设置日志时间记录为开始时间或结束时间。",
    keywords: ["时间点", "开始", "结束", "模式", "日志时间"],
    tab: "basic",
    section: "time-point-mode",
  },
  {
    id: "navigation-style",
    title: "导航样式",
    description: "切换顶部导航、底部导航或悬浮导航。",
    keywords: ["导航", "顶部", "底部", "悬浮", "UI"],
    tab: "basic",
    section: "navigation-style",
  },
  {
    id: "server-config",
    title: "服务配置",
    description: "配置服务端口和数据库路径。",
    keywords: ["端口", "数据库", "db", "路径", "server", "port"],
    tab: "basic",
    section: "server-config",
  },
  {
    id: "auth-config",
    title: "认证配置",
    description: "配置 JWT 过期时间等认证参数。",
    keywords: ["JWT", "认证", "登录", "过期时间", "token"],
    tab: "basic",
    section: "auth-config",
  },
  {
    id: "mcp-service",
    title: "MCP 服务",
    description: "启用或调整 MCP 服务端口。",
    keywords: ["MCP", "端口", "服务", "集成"],
    tab: "basic",
    section: "mcp-service",
  },
  {
    id: "ai-provider",
    title: "AI 提供商",
    description: "管理 AI 接口、模型和默认提供商。",
    keywords: ["AI", "模型", "provider", "接口", "大模型"],
    tab: "basic",
    section: "ai-provider",
  },
  {
    id: "webhook-settings",
    title: "Webhook 设置",
    description: "管理 Webhook 地址、方法和请求内容。",
    keywords: ["Webhook", "回调", "HTTP", "请求", "通知"],
    tab: "automation",
    section: "webhook-settings",
  },
  {
    id: "event-bindings",
    title: "事件绑定",
    description: "为事件绑定对应的 Webhook。",
    keywords: ["事件", "绑定", "Webhook", "触发", "event"],
    tab: "automation",
    section: "event-bindings",
  },
  {
    id: "scheduled-tasks",
    title: "定时任务",
    description: "管理定时上报和计划任务。",
    keywords: ["定时", "任务", "计划", "cron", "调度"],
    tab: "automation",
    section: "scheduled-tasks",
  },
  {
    id: "categories",
    title: "分类管理",
    description: "管理日志分类和分类规则。",
    keywords: ["分类", "规则", "类别", "category", "匹配"],
    tab: "categories",
    section: "categories",
  },
]

export function isSettingsSearchTab(value: string): value is SettingsSearchTab {
  return value === "app-info" || value === "basic" || value === "tokens" || value === "automation" || value === "categories"
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function scoreSettingsItem(item: SettingsSearchItem, query: string) {
  const normalizedTitle = normalizeSearchText(item.title)
  const normalizedDescription = normalizeSearchText(item.description)
  const normalizedKeywords = item.keywords.map(normalizeSearchText)

  let score = 0

  if (normalizedTitle === query) score += 160
  else if (normalizedTitle.startsWith(query)) score += 120
  else if (normalizedTitle.includes(query)) score += 90

  if (normalizedDescription.includes(query)) score += 45

  for (const keyword of normalizedKeywords) {
    if (keyword === query) score += 90
    else if (keyword.startsWith(query)) score += 65
    else if (keyword.includes(query)) score += 35
  }

  return score
}

export function searchSettingsItems(query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  return SETTINGS_SEARCH_ITEMS
    .map((item) => ({ item, score: scoreSettingsItem(item, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map((entry) => entry.item)
}
