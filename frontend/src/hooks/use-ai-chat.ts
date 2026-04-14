import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, subDays } from "date-fns"
import { streamAIChat, getAIProviders, getCategories, fetchAIModels } from "@/api"
import type { AIProvider, AIChatMessage, Category } from "@/types"
import { toast } from "sonner"
import {
  SYSTEM_PROMPT_KEY,
  readStoredSessions,
  writeStoredSessions,
  readStoredModelSelections,
  writeStoredModelSelection,
  parseDateString,
  createSessionId,
  buildSessionTitle,
  buildSessionPreview,
  uniqueStrings,
  summarizeCategories,
} from "@/components/statistics/ai-chat-shared"
import type { ChatMsg, ChatSession, RuntimeContext } from "@/components/statistics/ai-chat-shared"

export function useAIChat() {
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
  const streamTokenRef = useRef(0)
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

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { providersRef.current = providers }, [providers])
  useEffect(() => { currentSessionIdRef.current = currentSessionId }, [currentSessionId])
  useEffect(() => {
    runtimeRef.current = { fromDate, toDate, systemPrompt, selectedCategories, selectedModel, activeProviderName }
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

  useEffect(() => { loadProviders() }, [loadProviders])

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

    const nextMessages: ChatMsg[] = [
      ...messagesRef.current,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]
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

  return {
    fromDate, setFromDate, toDate, setToDate,
    fromOpen, setFromOpen, toOpen, setToOpen,
    messages, input, setInput, streaming,
    loadingProviders, providers,
    systemPrompt, showPrompt, setShowPrompt,
    showFilter, setShowFilter,
    allCategories, selectedCategories, setSelectedCategories,
    sessions, currentSessionId,
    historyOpen, setHistoryOpen,
    deleteTarget, setDeleteTarget,
    addDialogOpen, setAddDialogOpen,
    availableModels, selectedModel, loadingModels, modelLoadError,
    modelMenuOpen, setModelMenuOpen,
    activeProvider, activeProviderName, rangeSummary, filterSummary,
    currentSession, scrollRef,
    handlePromptChange, handleSelectModel, refreshModels,
    handleAbort, handleNewSession, openSession, handleDeleteSession,
    sendMessage, handleKeyDown, handleTextareaInput, loadProviders,
  }
}
