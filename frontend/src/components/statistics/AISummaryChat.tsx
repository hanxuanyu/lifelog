import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Send, Square, Sparkles, CalendarIcon, Settings2, Plus, Copy, Check, ChevronDown, Filter } from "lucide-react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { streamAIChat, getAIProviders, getCategories } from "@/api"
import type { AIProvider, AIChatMessage, Category } from "@/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { AIProviderDialog } from "@/components/settings/AIProviderDialog"
import { toast } from "sonner"

const QUICK_QUESTIONS = [
  "总结这段时间的活动",
  "分析时间分配是否合理",
  "有哪些值得改进的地方",
  "找出花费时间最多的活动",
]

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

const SYSTEM_PROMPT_KEY = "ai_system_prompt"
const SELECTED_PROVIDER_KEY = "ai_selected_provider"

interface ChatMsg { role: "user" | "assistant"; content: string }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors" title="复制">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "已复制" : "复制"}
    </button>
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
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>(() => localStorage.getItem(SELECTED_PROVIDER_KEY) || "")
  const [systemPrompt, setSystemPrompt] = useState<string>(() => localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  const [showPrompt, setShowPrompt] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showFilter, setShowFilter] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const startDate = format(fromDate, "yyyy-MM-dd")
  const endDate = format(toDate, "yyyy-MM-dd")
  const currentProvider = providers.find((p) => p.name === selectedProvider)

  const loadProviders = useCallback(() => {
    getAIProviders()
      .then((list) => {
        const items = list || []
        setProviders(items)
        if (items.length > 0 && !items.find((p) => p.name === selectedProvider)) {
          const def = items.find((p) => p.default) || items[0]
          setSelectedProvider(def.name)
          localStorage.setItem(SELECTED_PROVIDER_KEY, def.name)
        }
      })
      .catch(() => {})
  }, [selectedProvider])

  useEffect(() => { loadProviders() }, [])

  useEffect(() => {
    getCategories().then((cats) => setAllCategories(cats || [])).catch(() => {})
  }, [])

  const selectProvider = (name: string) => {
    setSelectedProvider(name)
    localStorage.setItem(SELECTED_PROVIDER_KEY, name)
    setModelMenuOpen(false)
  }

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value)
    localStorage.setItem(SYSTEM_PROMPT_KEY, value)
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, 50)
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return
    const userMsg: ChatMsg = { role: "user", content: text.trim() }
    const history: AIChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)
    scrollToBottom()

    const controller = new AbortController()
    abortRef.current = controller

    streamAIChat(
      { provider_name: selectedProvider || undefined, start_date: startDate, end_date: endDate, message: text.trim(), history, system_prompt: systemPrompt || undefined, categories: selectedCategories.length > 0 ? selectedCategories : undefined },
      (content) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === "assistant") updated[updated.length - 1] = { ...last, content: last.content + content }
          return updated
        })
        scrollToBottom()
      },
      () => { setStreaming(false); abortRef.current = null },
      (err) => {
        setStreaming(false); abortRef.current = null
        toast.error("AI 请求失败", { description: err })
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev
        })
      },
      controller.signal,
    )
  }, [messages, streaming, startDate, endDate, selectedProvider, systemPrompt, selectedCategories, scrollToBottom])

  const handleAbort = () => { abortRef.current?.abort(); setStreaming(false); abortRef.current = null }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 150) + "px"
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">尚未配置 AI 服务提供商</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 添加服务提供商
        </Button>
        <AIProviderDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSaved={loadProviders} />
      </div>
    )
  }

  // PLACEHOLDER_JSX

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] min-h-[300px]">
      {/* Top bar: date */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs font-normal gap-1 h-7">
              <CalendarIcon className="h-3 w-3" />
              {format(fromDate, "M月d日", { locale: zhCN })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fromDate}
              onSelect={(day) => { if (day) { setFromDate(day); if (day > toDate) setToDate(day); setFromOpen(false) } }}
              locale={zhCN} />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">—</span>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs font-normal gap-1 h-7">
              <CalendarIcon className="h-3 w-3" />
              {format(toDate, "M月d日", { locale: zhCN })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={toDate}
              onSelect={(day) => { if (day) { setToDate(day); if (day < fromDate) setFromDate(day); setToOpen(false) } }}
              locale={zhCN} />
          </PopoverContent>
        </Popover>
        {DATE_PRESETS.map((preset) => (
          <button key={preset.label} onClick={() => { const r = preset.range(); setFromDate(r.from); setToDate(r.to) }}
            className="px-2 py-0.5 rounded-full text-[11px] border bg-background hover:bg-accent transition-colors text-muted-foreground">
            {preset.label}
          </button>
        ))}
        <div className="flex-1" />
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">选择日期范围，向 AI 提问</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center px-4">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 rounded-full text-xs border bg-background hover:bg-accent transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "user" ? (
              <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-primary text-primary-foreground">
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            ) : (
              <div className="group">
                <div className="text-sm leading-relaxed">
                  {msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <span className="inline-flex gap-1 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
                {msg.content && !streaming && (
                  <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quick questions */}
      {messages.length > 0 && !streaming && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} onClick={() => sendMessage(q)}
              className="px-2.5 py-1 rounded-full text-[11px] border bg-background hover:bg-accent transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area — integrated card with model selector + textarea + send */}
      <div className="mt-2 rounded-xl border bg-background shadow-sm">
        {/* Collapsible panels inside card */}
        {showPrompt && (
          <div className="px-3 pt-2">
            <textarea value={systemPrompt} onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="输入自定义提示词，例如：请用表格形式输出、重点关注工作效率..."
              className="w-full h-14 rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
        )}
        {showFilter && allCategories.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-1.5 items-center">
            <button onClick={() => setSelectedCategories([])}
              className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                selectedCategories.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent text-muted-foreground"}`}>
              全部
            </button>
            {allCategories.map((cat) => {
              const active = selectedCategories.includes(cat.name)
              return (
                <button key={cat.name}
                  onClick={() => setSelectedCategories((prev) => active ? prev.filter((c) => c !== cat.name) : [...prev, cat.name])}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                    active ? "text-white border-transparent" : "bg-background hover:bg-accent text-muted-foreground"}`}
                  style={active ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}>
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder="输入你的问题..."
            disabled={streaming}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
            style={{ minHeight: "44px", maxHeight: "150px" }}
          />
          {/* Bottom bar inside input card */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
            {/* Model selector + filter/prompt toggles (left) */}
            <div className="flex items-center gap-0.5">
              <Popover open={modelMenuOpen} onOpenChange={setModelMenuOpen}>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Sparkles className="h-3 w-3" />
                    <span className="max-w-[100px] sm:max-w-[200px] truncate">
                      {currentProvider ? `${currentProvider.name} / ${currentProvider.model}` : "选择模型"}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-1.5" align="start" side="top">
                  <div className="space-y-0.5 max-h-72 overflow-y-auto">
                    {providers.map((p) => (
                      <button key={p.name} onClick={() => selectProvider(p.name)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                          p.name === selectedProvider ? "bg-accent" : "hover:bg-muted"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">{p.model}</div>
                        </div>
                        {p.name === selectedProvider && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                    <div className="border-t my-1" />
                    <button onClick={() => { setModelMenuOpen(false); setAddDialogOpen(true) }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm text-primary hover:bg-muted transition-colors">
                      <Plus className="h-3.5 w-3.5" /> 新增提供商
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
              <button onClick={() => setShowFilter(!showFilter)} title="数据筛选"
                className={`p-1 rounded-md transition-colors hover:bg-muted ${selectedCategories.length > 0 || showFilter ? "text-primary" : "text-muted-foreground"}`}>
                <Filter className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setShowPrompt(!showPrompt)} title="自定义提示词"
                className={`p-1 rounded-md transition-colors hover:bg-muted ${systemPrompt || showPrompt ? "text-primary" : "text-muted-foreground"}`}>
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Send / Abort button (right) */}
            {streaming ? (
              <Button size="icon" variant="destructive" onClick={handleAbort} className="h-7 w-7 rounded-lg shrink-0">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim()} className="h-7 w-7 rounded-lg shrink-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <AIProviderDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSaved={loadProviders} />
    </div>
  )
}
