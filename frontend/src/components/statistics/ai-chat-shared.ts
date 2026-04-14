import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"

export const QUICK_QUESTIONS = [
  "总结这段时间的活动重点",
  "分析时间分配是否合理",
  "有哪些值得改进的地方",
  "找出花费时间最多的活动",
]

export const SYSTEM_PROMPT_KEY = "ai_system_prompt"
export const CHAT_SESSIONS_KEY = "ai_summary_sessions_v2"
export const MODEL_SELECTIONS_KEY = "ai_summary_model_selections_v1"

export interface DatePreset {
  label: string
  range: () => { from: Date; to: Date }
}

export const DATE_PRESETS: DatePreset[] = [
  { label: "近7天", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "近30天", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "本周", range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "本月", range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "上月", range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
]

export interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

export interface ChatSession {
  id: string
  title: string
  preview: string
  provider_name: string
  model: string
  start_date: string
  end_date: string
  system_prompt: string
  categories: string[]
  messages: ChatMsg[]
  created_at: string
  updated_at: string
}

export interface RuntimeContext {
  fromDate: Date
  toDate: Date
  systemPrompt: string
  selectedCategories: string[]
  selectedModel: string
  activeProviderName: string
}

export function readStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is ChatSession => {
        return !!item
          && typeof item.id === "string"
          && typeof item.title === "string"
          && typeof item.preview === "string"
          && typeof item.provider_name === "string"
          && typeof item.model === "string"
          && typeof item.start_date === "string"
          && typeof item.end_date === "string"
          && typeof item.system_prompt === "string"
          && Array.isArray(item.categories)
          && Array.isArray(item.messages)
          && typeof item.created_at === "string"
          && typeof item.updated_at === "string"
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  } catch {
    return []
  }
}

export function writeStoredSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions))
}

export function readStoredModelSelections(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MODEL_SELECTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"),
    )
  } catch {
    return {}
  }
}

export function writeStoredModelSelection(providerName: string, modelName: string) {
  const next = readStoredModelSelections()
  next[providerName] = modelName
  localStorage.setItem(MODEL_SELECTIONS_KEY, JSON.stringify(next))
}

export function parseDateString(value: string, fallback: Date) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function createSessionId() {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function buildSessionTitle(messages: ChatMsg[], startDate: string, endDate: string) {
  const firstUser = messages.find((msg) => msg.role === "user" && msg.content.trim())
  if (!firstUser) return `${startDate} ~ ${endDate}`
  return truncateText(collapseWhitespace(firstUser.content), 24)
}

export function buildSessionPreview(messages: ChatMsg[]) {
  const lastContent = [...messages].reverse().find((msg) => msg.content.trim())
  if (!lastContent) return "暂无内容"
  return truncateText(collapseWhitespace(lastContent.content), 42)
}

export function formatSessionTime(updatedAt: string) {
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) return updatedAt
  return format(parsed, "MM-dd HH:mm")
}

export function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of values) {
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function summarizeCategories(names: string[]) {
  if (names.length === 0) return "全部分类"
  if (names.length === 1) return names[0]
  return `${names[0]} 等 ${names.length} 类`
}
