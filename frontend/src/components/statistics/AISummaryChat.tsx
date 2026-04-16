import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Bot,
  CalendarIcon,
  Check,
  ChevronDown,
  Filter,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Square,
} from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { AIProviderDialog } from "@/components/settings/AIProviderDialog"
import { cn } from "@/lib/utils"
import { QUICK_QUESTIONS, DATE_PRESETS } from "./ai-chat-shared"
import { CopyButton, SessionList } from "./SessionList"
import { useAIChat } from "@/hooks/use-ai-chat"
import { getPrompts, createPrompt } from "@/api"
import type { Prompt } from "@/types"
import { toast } from "sonner"

export function AISummaryChat() {
  const {
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
    activeProvider, filterSummary,
    scrollRef,
    handlePromptChange, handleSelectModel, refreshModels,
    handleAbort, handleNewSession, openSession, handleDeleteSession,
    sendMessage, handleKeyDown, handleTextareaInput, loadProviders,
  } = useAIChat()

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [newPromptName, setNewPromptName] = useState("")
  const [newPromptDesc, setNewPromptDesc] = useState("")
  const [newPromptContent, setNewPromptContent] = useState("")
  const [savingPrompt, setSavingPrompt] = useState(false)

  const loadPrompts = useCallback(() => {
    getPrompts().then((list) => setPrompts(list || [])).catch(() => {})
  }, [])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const handleCreatePrompt = async () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      toast.error("名称和内容不能为空")
      return
    }
    setSavingPrompt(true)
    try {
      await createPrompt({ name: newPromptName.trim(), content: newPromptContent.trim(), description: newPromptDesc.trim() })
      toast.success("提示词创建成功")
      setPromptDialogOpen(false)
      setNewPromptName("")
      setNewPromptDesc("")
      setNewPromptContent("")
      loadPrompts()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "创建失败"
      toast.error(msg)
    } finally {
      setSavingPrompt(false)
    }
  }

  const userPrompts = prompts.filter((p) => !p.builtin)

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
                {userPrompts.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2 px-4">
                    {userPrompts.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => sendMessage(p.content)}
                        title={p.name}
                        className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                      >
                        {p.description || p.name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPromptDialogOpen(true)}
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> 添加提示词
                </button>
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
                              <MarkdownRenderer content={message.content} preserveLineBreaks />
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
                {userPrompts.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => sendMessage(p.content)}
                    title={p.name}
                    className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-[11px] transition-colors hover:bg-accent"
                  >
                    {p.description || p.name}
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

      <Dialog open={promptDialogOpen} onOpenChange={(open) => { setPromptDialogOpen(open); if (!open) { setNewPromptName(""); setNewPromptDesc(""); setNewPromptContent("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加自定义提示词</DialogTitle>
            <DialogDescription>创建一个可复用的提示词模板，可在 AI 对话和定时任务中使用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">名称</label>
              <Input value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="如：周报重点分析" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">描述</label>
              <Input value={newPromptDesc} onChange={(e) => setNewPromptDesc(e.target.value)} placeholder="简短描述，显示为按钮文字" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">内容</label>
              <Textarea value={newPromptContent} onChange={(e) => setNewPromptContent(e.target.value)} placeholder="输入提示词内容..." rows={5} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreatePrompt} disabled={savingPrompt}>
              {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
