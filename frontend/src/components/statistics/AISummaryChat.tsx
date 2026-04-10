import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  Bot,
  CalendarIcon,
  Check,
  ChevronDown,
  Copy,
  Filter,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { streamAIChat, getAIProviders, getCategories, fetchAIModels } from "@/api"
import type { AIProvider, AIChatMessage, Category } from "@/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { AIProviderDialog } from "@/components/settings/AIProviderDialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const QUICK_QUESTIONS = [
  "总结这段时间的活动重点",
  "分析时间分配是否合理",
  "有哪些值得改进的地方",
  "找出花费时间最多的活动",
]

const SYSTEM_PROMPT_KEY = "ai_system_prompt"
const CHAT_SESSIONS_KEY = "ai_summary_sessions_v2"
const MODEL_SELECTIONS_KEY = "ai_summary_model_selections_v1"

interface DatePreset {
  label: string
  range: () => { from: Date; to: Date }
}

const DATE_PRESETS: DatePreset[] = [
  { label: "近7天", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "近30天", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "本周", range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "本月", range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "上月", range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
]

interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

interface ChatSession {
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

interface RuntimeContext {
  fromDate: Date
  toDate: Date
  systemPrompt: string
  selectedCategories: string[]
  selectedModel: string
  activeProviderName: string
}

function readStoredSessions(): ChatSession[] {
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

function writeStoredSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions))
}

function readStoredModelSelections(): Record<string, string> {
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

function writeStoredModelSelection(providerName: string, modelName: string) {
  const next = readStoredModelSelections()
  next[providerName] = modelName
  localStorage.setItem(MODEL_SELECTIONS_KEY, JSON.stringify(next))
}

function parseDateString(value: string, fallback: Date) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function createSessionId() {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function buildSessionTitle(messages: ChatMsg[], startDate: string, endDate: string) {
  const firstUser = messages.find((msg) => msg.role === "user" && msg.content.trim())
  if (!firstUser) return `${startDate} ~ ${endDate}`
  return truncateText(collapseWhitespace(firstUser.content), 24)
}

function buildSessionPreview(messages: ChatMsg[]) {
  const lastContent = [...messages].reverse().find((msg) => msg.content.trim())
  if (!lastContent) return "暂无内容"
  return truncateText(collapseWhitespace(lastContent.content), 42)
}

function formatSessionTime(updatedAt: string) {
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) return updatedAt
  return format(parsed, "MM-dd HH:mm")
}

function uniqueStrings(values: string[]) {
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

function summarizeCategories(names: string[]) {
  if (names.length === 0) return "全部分类"
  if (names.length === 1) return names[0]
  return `${names[0]} 等 ${names.length} 类`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      title="复制"
      type="button"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  )
}

interface SessionListProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onOpen: (session: ChatSession) => void
  onDelete: (session: ChatSession) => void
  onNew: () => void
  className?: string
}

function SessionList({ sessions, currentSessionId, onOpen, onDelete, onNew, className }: SessionListProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div>
          <div className="text-sm font-medium">历史会话</div>
          <div className="text-xs text-muted-foreground">支持打开、继续和删除</div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          新会话
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              还没有保存的 AI 会话
            </div>
          ) : (
            sessions.map((session) => {
              const active = session.id === currentSessionId
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                    active ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(session)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{session.title}</span>
                      {active && <Badge variant="secondary" className="h-5 text-[10px]">当前</Badge>}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{session.preview}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{session.provider_name || "默认服务商"}</span>
                      <span className="font-mono">{session.model}</span>
                      <span>{session.start_date} ~ {session.end_date}</span>
                      <span>{formatSessionTime(session.updated_at)}</span>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(session)}
                    title={`删除 ${session.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function AISummaryChat() {
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 6))
  const [toDate, setToDate] = useState<Date>(new Date())
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [systemPrompt, setSystemPrompt] = useState<string>(() => localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  const [showPrompt, setShowPrompt] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStoredSessions())
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelLoadError, setModelLoadError] = useState("")
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMsg[]>(messages)
  const sessionsRef = useRef<ChatSession[]>(sessions)
  const providersRef = useRef<AIProvider[]>(providers)
  const currentSessionIdRef = useRef<string | null>(currentSessionId)
  const modelCacheRef = useRef<Record<string, string[]>>({})
  const runtimeRef = useRef<RuntimeContext>({
    fromDate,
    toDate,
    systemPrompt,
    selectedCategories,
    selectedModel,
    activeProviderName: "",
  })

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId) || null,
    [sessions, currentSessionId],
  )
  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.default) || providers[0] || null,
    [providers],
  )
  const activeProviderName = useMemo(() => {
    if (currentSession?.provider_name && providers.some((provider) => provider.name === currentSession.provider_name)) {
      return currentSession.provider_name
    }
    return defaultProvider?.name || ""
  }, [currentSession?.provider_name, defaultProvider?.name, providers])
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.name === activeProviderName) || defaultProvider || null,
    [activeProviderName, defaultProvider, providers],
  )
  const rangeSummary = useMemo(
    () => `${format(fromDate, "MM.dd")} - ${format(toDate, "MM.dd")}`,
    [fromDate, toDate],
  )
  const contextSummary = useMemo(
    () => selectedCategories.length > 0 ? summarizeCategories(selectedCategories) : "全部分类",
    [selectedCategories],
  )
  const filterSummary = useMemo(
    () => `${rangeSummary} · ${contextSummary}`,
    [rangeSummary, contextSummary],
  )

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    providersRef.current = providers
  }, [providers])

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    runtimeRef.current = {
      fromDate,
      toDate,
      systemPrompt,
      selectedCategories,
      selectedModel,
      activeProviderName,
    }
  }, [fromDate, toDate, systemPrompt, selectedCategories, selectedModel, activeProviderName])

  const persistSessions = useCallback((nextSessions: ChatSession[]) => {
    const normalized = [...nextSessions]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 40)
    sessionsRef.current = normalized
    setSessions(normalized)
    writeStoredSessions(normalized)
  }, [])

  const buildSessionSnapshot = useCallback((sessionId: string, nextMessages: ChatMsg[]): ChatSession => {
    const runtime = runtimeRef.current
    const startDate = format(runtime.fromDate, "yyyy-MM-dd")
    const endDate = format(runtime.toDate, "yyyy-MM-dd")
    const existing = sessionsRef.current.find((session) => session.id === sessionId)
    const provider = providersRef.current.find((item) => item.name === runtime.activeProviderName)
    const now = new Date().toISOString()

    return {
      id: sessionId,
      title: buildSessionTitle(nextMessages, startDate, endDate),
      preview: buildSessionPreview(nextMessages),
      provider_name: runtime.activeProviderName,
      model: runtime.selectedModel || provider?.model || "",
      start_date: startDate,
      end_date: endDate,
      system_prompt: runtime.systemPrompt,
      categories: [...runtime.selectedCategories],
      messages: nextMessages,
      created_at: existing?.created_at || now,
      updated_at: now,
    }
  }, [])

  const upsertSessionSnapshot = useCallback((sessionId: string, nextMessages: ChatMsg[]) => {
    if (nextMessages.length === 0) return
    const snapshot = buildSessionSnapshot(sessionId, nextMessages)
    persistSessions([snapshot, ...sessionsRef.current.filter((session) => session.id !== sessionId)])
  }, [buildSessionSnapshot, persistSessions])

  const replaceMessages = useCallback((nextMessages: ChatMsg[]) => {
    messagesRef.current = nextMessages
    setMessages(nextMessages)
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, 40)
  }, [])

  const pruneEmptyAssistant = useCallback(() => {
    const current = messagesRef.current
    const last = current[current.length - 1]
    if (!last || last.role !== "assistant" || last.content.trim()) return
    const next = current.slice(0, -1)
    replaceMessages(next)
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return
    if (next.length === 0) {
      persistSessions(sessionsRef.current.filter((session) => session.id !== sessionId))
      setCurrentSessionId(null)
      currentSessionIdRef.current = null
      return
    }
    upsertSessionSnapshot(sessionId, next)
  }, [persistSessions, replaceMessages, upsertSessionSnapshot])

  const loadProviders = useCallback(() => {
    setLoadingProviders(true)
    getAIProviders()
      .then((list) => setProviders(list || []))
      .catch(() => toast.error("加载 AI 服务商失败"))
      .finally(() => setLoadingProviders(false))
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  useEffect(() => {
    getCategories()
      .then((categories) => setAllCategories(categories || []))
      .catch(() => {})
  }, [])

  const loadModelsForProvider = useCallback(async (provider: AIProvider, preferredModel: string) => {
    const cached = modelCacheRef.current[provider.name]
    const applyModels = (models: string[], errorMessage?: string) => {
      const merged = uniqueStrings([preferredModel, provider.model, ...models])
      setAvailableModels(merged)
      setSelectedModel((current) => {
        const target = preferredModel || current || provider.model
        return merged.includes(target) ? target : merged[0] || provider.model
      })
      setModelLoadError(errorMessage || "")
    }

    if (cached && cached.length > 0) {
      applyModels(cached)
      return
    }

    setLoadingModels(true)
    try {
      const res = await fetchAIModels(provider.endpoint, provider.api_key, provider.name)
      if (res.code !== 200 || !res.data || res.data.length === 0) {
        throw new Error(res.message || "未获取到模型列表")
      }
      modelCacheRef.current[provider.name] = res.data
      applyModels(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "模型列表获取失败，已回退到默认模型"
      applyModels([], message)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    if (!activeProvider) {
      setAvailableModels([])
      setSelectedModel("")
      return
    }

    const storedSelections = readStoredModelSelections()
    const preferredModel = currentSession?.model || storedSelections[activeProvider.name] || activeProvider.model
    setSelectedModel(preferredModel)
    void loadModelsForProvider(activeProvider, preferredModel)
  }, [activeProvider, currentSession?.id, currentSession?.model, loadModelsForProvider])

  useEffect(() => {
    if (!currentSessionIdRef.current || messagesRef.current.length === 0) return
    upsertSessionSnapshot(currentSessionIdRef.current, messagesRef.current)
  }, [fromDate, toDate, systemPrompt, selectedCategories, selectedModel, activeProviderName, upsertSessionSnapshot])

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value)
    localStorage.setItem(SYSTEM_PROMPT_KEY, value)
  }

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName)
    if (activeProvider) {
      writeStoredModelSelection(activeProvider.name, modelName)
    }
    setModelMenuOpen(false)
  }

  const refreshModels = async () => {
    if (!activeProvider) return
    delete modelCacheRef.current[activeProvider.name]
    await loadModelsForProvider(activeProvider, selectedModel || activeProvider.model)
  }

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    pruneEmptyAssistant()
  }, [pruneEmptyAssistant])

  const handleNewSession = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
    setCurrentSessionId(null)
    currentSessionIdRef.current = null
    replaceMessages([])
    setInput("")
    setHistoryOpen(false)
  }, [replaceMessages])

  const openSession = useCallback((session: ChatSession) => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
    setCurrentSessionId(session.id)
    currentSessionIdRef.current = session.id
    replaceMessages(session.messages || [])
    setFromDate(parseDateString(session.start_date, subDays(new Date(), 6)))
    setToDate(parseDateString(session.end_date, new Date()))
    setSystemPrompt(session.system_prompt || "")
    localStorage.setItem(SYSTEM_PROMPT_KEY, session.system_prompt || "")
    setSelectedCategories(session.categories || [])
    setSelectedModel(session.model || "")
    setInput("")
    setHistoryOpen(false)
    scrollToBottom()
  }, [replaceMessages, scrollToBottom])

  const handleDeleteSession = useCallback(() => {
    if (!deleteTarget) return
    const deletingId = deleteTarget.id
    persistSessions(sessionsRef.current.filter((session) => session.id !== deletingId))
    if (currentSessionIdRef.current === deletingId) {
      setCurrentSessionId(null)
      currentSessionIdRef.current = null
      replaceMessages([])
      setInput("")
    }
    setDeleteTarget(null)
  }, [deleteTarget, persistSessions, replaceMessages])

  const sendMessage = useCallback((rawText: string) => {
    const text = rawText.trim()
    if (!text || streaming || !activeProvider) return

    const history: AIChatMessage[] = messagesRef.current.map((message) => ({
      role: message.role,
      content: message.content,
    }))
    const sessionId = currentSessionIdRef.current || createSessionId()
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = sessionId
      setCurrentSessionId(sessionId)
    }

    const nextMessages = [...messagesRef.current, { role: "user", content: text }, { role: "assistant", content: "" }]
    replaceMessages(nextMessages)
    upsertSessionSnapshot(sessionId, nextMessages)
    setInput("")
    setStreaming(true)
    scrollToBottom()

    const runtime = runtimeRef.current
    const controller = new AbortController()
    abortRef.current = controller

    streamAIChat(
      {
        provider_name: activeProvider.name,
        model: (runtime.selectedModel || activeProvider.model) || undefined,
        start_date: format(runtime.fromDate, "yyyy-MM-dd"),
        end_date: format(runtime.toDate, "yyyy-MM-dd"),
        message: text,
        history,
        system_prompt: runtime.systemPrompt || undefined,
        categories: runtime.selectedCategories.length > 0 ? runtime.selectedCategories : undefined,
      },
      (content) => {
        const updated = [...messagesRef.current]
        const last = updated[updated.length - 1]
        if (last?.role !== "assistant") return
        updated[updated.length - 1] = { ...last, content: last.content + content }
        replaceMessages(updated)
        upsertSessionSnapshot(sessionId, updated)
        scrollToBottom()
      },
      () => {
        setStreaming(false)
        abortRef.current = null
        upsertSessionSnapshot(sessionId, messagesRef.current)
      },
      (err) => {
        setStreaming(false)
        abortRef.current = null
        toast.error("AI 请求失败", { description: err })
        pruneEmptyAssistant()
      },
      controller.signal,
    )
  }, [activeProvider, pruneEmptyAssistant, replaceMessages, scrollToBottom, streaming, upsertSessionSnapshot])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const element = e.currentTarget
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }

  if (loadingProviders) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载 AI 配置中...
        </div>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border py-16 text-center">
        <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">尚未配置 AI 服务商</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          添加服务商
        </Button>
        <AIProviderDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSaved={loadProviders} />
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-background/70">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Badge variant="outline" className="h-8 rounded-lg px-3 font-normal">
                {activeProvider?.name || "未选择服务商"}
              </Badge>
              <Popover open={modelMenuOpen} onOpenChange={setModelMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 min-w-0 gap-1.5">
                    <Bot className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[118px] truncate font-mono text-xs sm:max-w-[220px]">
                      {selectedModel || activeProvider?.model || "选择模型"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-2" side="bottom">
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{activeProvider?.name}</div>
                      <div className="text-[11px] text-muted-foreground">切换该服务商下的模型</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={refreshModels}
                      disabled={loadingModels || !activeProvider}
                      title="刷新模型列表"
                    >
                      {loadingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <Separator className="mb-2" />
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {availableModels.map((modelName) => (
                      <button
                        key={modelName}
                        type="button"
                        onClick={() => handleSelectModel(modelName)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                          modelName === selectedModel ? "bg-accent" : "hover:bg-muted",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-mono">{modelName}</div>
                        </div>
                        {modelName === selectedModel && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    ))}
                    {availableModels.length === 0 && (
                      <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">暂无可选模型</div>
                    )}
                  </div>
                  {modelLoadError && <p className="px-1 pt-2 text-[11px] text-amber-600">{modelLoadError}</p>}
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setHistoryOpen(true)}
                title="历史会话"
                aria-label="历史会话"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleNewSession}
                title="新对话"
                aria-label="新对话"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:px-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">选择日期范围，向 AI 提问</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 px-4">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isStreamingAssistant = streaming && index === messages.length - 1 && message.role === "assistant"
                  return (
                    <motion.div
                      key={`${index}-${message.role}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={message.role === "user" ? "flex justify-end" : ""}
                    >
                      {message.role === "user" ? (
                        <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:max-w-[72%]">
                          <span className="whitespace-pre-wrap">{message.content}</span>
                        </div>
                      ) : (
                        <div className="group max-w-full">
                          {!message.content && streaming ? (
                            <div className="inline-flex gap-1 py-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                            </div>
                          ) : isStreamingAssistant ? (
                            <div className="whitespace-pre-wrap text-sm leading-7">
                              {message.content}
                              <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-primary/60 align-middle" />
                            </div>
                          ) : (
                            <div className="text-sm leading-relaxed">
                              <MarkdownRenderer content={message.content} />
                            </div>
                          )}
                          {message.content && !isStreamingAssistant && (
                            <div className="mt-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <CopyButton text={message.content} />
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {messages.length > 0 && !streaming && (
            <div className="px-3 pb-2 sm:px-4">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="rounded-full border bg-background px-2.5 py-1 text-[11px] transition-colors hover:bg-accent"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t px-3 py-3 sm:px-4">
            <div className="rounded-2xl border bg-card shadow-sm">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleTextareaInput}
                placeholder="输入你的问题..."
                disabled={streaming}
                rows={1}
                className="min-h-[60px] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
                style={{ maxHeight: 180 }}
              />
              <div className="flex items-center gap-2 border-t px-3 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  <Popover open={showFilter} onOpenChange={setShowFilter}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={showFilter || selectedCategories.length > 0 ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 min-w-0 gap-1.5"
                        title="时间范围与上下文过滤"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="max-w-[116px] truncate text-xs sm:max-w-[240px]">
                          {filterSummary}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(92vw,30rem)] space-y-3 p-3" side="top">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-foreground">时间范围</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Popover open={fromOpen} onOpenChange={setFromOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(fromDate, "MM.dd")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={fromDate}
                                onSelect={(day) => {
                                  if (!day) return
                                  setFromDate(day)
                                  if (day > toDate) setToDate(day)
                                  setFromOpen(false)
                                }}
                                locale={zhCN}
                              />
                            </PopoverContent>
                          </Popover>

                          <span className="text-xs text-muted-foreground">至</span>

                          <Popover open={toOpen} onOpenChange={setToOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(toDate, "MM.dd")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={toDate}
                                onSelect={(day) => {
                                  if (!day) return
                                  setToDate(day)
                                  if (day < fromDate) setFromDate(day)
                                  setToOpen(false)
                                }}
                                locale={zhCN}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DATE_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const range = preset.range()
                                setFromDate(range.from)
                                setToDate(range.to)
                              }}
                              className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-foreground">上下文过滤</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCategories([])}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                              selectedCategories.length === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
                            )}
                          >
                            全部
                          </button>
                          {allCategories.map((category) => {
                            const active = selectedCategories.includes(category.name)
                            return (
                              <button
                                key={category.name}
                                type="button"
                                onClick={() => setSelectedCategories((prev) => active ? prev.filter((item) => item !== category.name) : [...prev, category.name])}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                                  active ? "border-transparent text-white" : "bg-background hover:bg-accent",
                                )}
                                style={active ? { backgroundColor: category.color, borderColor: category.color } : undefined}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-muted-foreground">
                          {filterSummary}
                        </div>
                        <Button type="button" size="sm" className="h-7" onClick={() => setShowFilter(false)}>
                          完成
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover open={showPrompt} onOpenChange={setShowPrompt}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={showPrompt || !!systemPrompt ? "secondary" : "outline"}
                        size="icon-sm"
                        title="自定义提示词"
                        aria-label="自定义提示词"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(92vw,28rem)] space-y-3 p-3" side="top">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-foreground">自定义提示词</div>
                        <Textarea
                          value={systemPrompt}
                          onChange={(e) => handlePromptChange(e.target.value)}
                          placeholder="输入自定义提示词，例如：请重点关注工作效率、输出可执行建议。"
                          className="min-h-[96px] resize-none border bg-background text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-muted-foreground truncate">
                          {systemPrompt ? "已配置自定义提示词" : "未配置自定义提示词"}
                        </div>
                        <Button type="button" size="sm" className="h-7" onClick={() => setShowPrompt(false)}>
                          完成
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {streaming ? (
                  <Button size="icon-sm" variant="destructive" onClick={handleAbort} className="shrink-0 rounded-lg">
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon-sm"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || !activeProvider}
                    className="shrink-0 rounded-lg"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-lg lg:max-w-xl">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>历史会话</DialogTitle>
            <DialogDescription>打开已有会话，或删除不需要的记录。</DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] min-h-0 pb-4">
            <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              onOpen={openSession}
              onDelete={setDeleteTarget}
              onNew={handleNewSession}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除会话“{deleteTarget?.title}”吗？该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIProviderDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSaved={loadProviders} />
    </>
  )
}
