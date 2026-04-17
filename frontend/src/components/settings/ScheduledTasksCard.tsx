import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getScheduledTasks, runScheduledTask, updateScheduledTasks } from "@/api"
import { toast } from "sonner"
import type {
  ScheduledTaskExecutionResult,
  ScheduledTaskInfo,
  ScheduledTaskParamDefinition,
} from "@/types"

const commonCronPresets = [
  { label: "每 30 分钟", cron: "0 */30 * * * *" },
  { label: "每小时", cron: "0 0 * * * *" },
  { label: "每天 09:00", cron: "0 0 9 * * *" },
  { label: "工作日 09:00", cron: "0 0 9 * * 1-5" },
  { label: "每周一 09:00", cron: "0 0 9 * * 1" },
  { label: "每月 1 日 09:00", cron: "0 0 9 1 * *" },
]

function formatDateTime(ts?: string) {
  if (!ts) return ""
  const value = new Date(ts)
  if (Number.isNaN(value.getTime())) return ""
  return value.toLocaleString()
}

function formatDurationMs(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return ""
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`
}

function getCronPresets(task: ScheduledTaskInfo) {
  const presets = [{ label: "默认推荐", cron: task.default_cron }, ...commonCronPresets]
  const seen = new Set<string>()
  return presets.filter((preset) => {
    if (seen.has(preset.cron)) return false
    seen.add(preset.cron)
    return true
  })
}

function getEditableParamDefinitions(task: ScheduledTaskInfo) {
  return (task.param_definitions || []).filter((param) => !param.read_only)
}

function normalizeParamValue(param: ScheduledTaskParamDefinition) {
  if (param.type === "boolean") {
    return param.value === "true" ? "true" : "false"
  }
  return param.value?.trim() || ""
}

function getEditableParamValues(task: ScheduledTaskInfo) {
  return Object.fromEntries(
    getEditableParamDefinitions(task).map((param) => [param.key, normalizeParamValue(param)]),
  )
}

function buildTaskPayload(task: ScheduledTaskInfo) {
  const params = Object.fromEntries(
    getEditableParamDefinitions(task)
      .map((param) => [param.key, normalizeParamValue(param)] as const)
      .filter(([_, value]) => value !== "" && value !== "false" && value !== "{}"),
  )

  return {
    name: task.name,
    cron: task.cron,
    enabled: task.enabled,
    params,
  }
}

function isBooleanEnabled(value?: string) {
  return value === "true"
}

function formatParamSummary(param: ScheduledTaskParamDefinition) {
  const value = normalizeParamValue(param)
  if (param.type === "boolean") {
    return `${param.label}: ${isBooleanEnabled(value) ? "开启" : "关闭"}`
  }
  if (param.type === "select") {
    const option = param.options?.find((item) => item.value === value)
    return option ? `${param.label}: ${option.label}` : ""
  }
  if (param.type === "multi_select") {
    const count = value ? value.split(",").filter(Boolean).length : 0
    return count > 0 ? `${param.label}: 已选 ${count} 项` : ""
  }
  if (param.type === "map") {
    try {
      const count = Object.keys(value ? JSON.parse(value) : {}).length
      return count > 0 ? `${param.label}: ${count} 组键值` : ""
    } catch {
      return ""
    }
  }
  if (!value) return ""
  if (param.key === "custom_prompt") {
    return `${param.label}: ${value.length > 30 ? `${value.slice(0, 30)}...` : value}`
  }
  return `${param.label}: ${value}`
}

function getResultStatusMeta(result?: ScheduledTaskExecutionResult) {
  switch (result?.status) {
    case "running":
      return { label: "执行中", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "success":
      return { label: "成功", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "failed":
      return { label: "失败", className: "bg-red-50 text-red-700 border-red-200" }
    case "skipped":
      return { label: "已跳过", className: "bg-amber-50 text-amber-700 border-amber-200" }
    case "noop":
      return { label: "无结果", className: "bg-slate-50 text-slate-700 border-slate-200" }
    default:
      return { label: "暂无", className: "bg-muted text-muted-foreground border-border" }
  }
}

function summarizeResultData(data?: Record<string, string>) {
  if (!data) return []

  const orderedKeys = [
    "report_provider",
    "report_model",
    "report_date",
    "start_date",
    "end_date",
    "total_known",
    "summary",
    "message",
  ]

  const used = new Set<string>()
  const entries: Array<[string, string]> = []

  for (const key of orderedKeys) {
    const value = data[key]
    if (!value) continue
    used.add(key)
    entries.push([key, value])
  }

  for (const [key, value] of Object.entries(data)) {
    if (used.has(key) || key === "detail" || key === "timestamp") continue
    entries.push([key, value])
  }

  return entries
}

function formatResultKey(key: string) {
  switch (key) {
    case "report_provider":
      return "提供商"
    case "report_model":
      return "模型"
    case "report_date":
      return "报告日期"
    case "start_date":
      return "开始日期"
    case "end_date":
      return "结束日期"
    case "total_known":
      return "已知时长"
    case "summary":
      return "摘要"
    case "message":
      return "消息"
    default:
      return key
  }
}

export function ScheduledTasksCard() {
  const [tasks, setTasks] = useState<ScheduledTaskInfo[]>([])
  const [draftCrons, setDraftCrons] = useState<Record<string, string>>({})
  const [draftParams, setDraftParams] = useState<Record<string, Record<string, string>>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingCron, setEditingCron] = useState<string | null>(null)
  const [parameterEditor, setParameterEditor] = useState<string | null>(null)
  const [resultViewer, setResultViewer] = useState<string | null>(null)
  const [runningTask, setRunningTask] = useState<string | null>(null)
  const [savingTask, setSavingTask] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const syncTasks = useCallback((next: ScheduledTaskInfo[], clearedDrafts: string[] = []) => {
    setTasks(next)

    setDraftCrons((prev) => {
      const cronByName = new Map(next.map((task) => [task.name, task.cron]))
      const cleared = new Set(clearedDrafts)
      const filtered: Record<string, string> = {}
      let changed = false

      for (const [name, cron] of Object.entries(prev)) {
        const savedCron = cronByName.get(name)
        const keep = savedCron !== undefined && savedCron !== cron && !cleared.has(name)
        if (keep) {
          filtered[name] = cron
        } else {
          changed = true
        }
      }

      return changed ? filtered : prev
    })

    setDraftParams((prev) => {
      const currentValues = new Map(next.map((task) => [task.name, getEditableParamValues(task)]))
      const cleared = new Set(clearedDrafts)
      const filtered: Record<string, Record<string, string>> = {}
      let changed = false

      for (const [taskName, values] of Object.entries(prev)) {
        if (cleared.has(taskName)) {
          changed = true
          continue
        }

        const savedValues = currentValues.get(taskName)
        if (!savedValues) {
          changed = true
          continue
        }

        const nextValues = Object.fromEntries(
          Object.entries(values).filter(([key, value]) => (savedValues[key] || "") !== value),
        )

        if (Object.keys(nextValues).length > 0) {
          filtered[taskName] = nextValues
        } else {
          changed = true
        }
      }

      return changed ? filtered : prev
    })
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const list = await getScheduledTasks()
      syncTasks(list || [])
    } catch {
      toast.error("加载定时任务失败")
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [syncTasks])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const scheduleRefreshBurst = useCallback(() => {
    const delays = [1000, 3000, 6000]
    delays.forEach((delay) => {
      window.setTimeout(() => {
        void load(true)
      }, delay)
    })
  }, [load])

  const applyDraftsToTask = useCallback((task: ScheduledTaskInfo): ScheduledTaskInfo => {
    const cron = draftCrons[task.name] ?? task.cron
    const paramDrafts = draftParams[task.name] || {}
    const paramDefinitions = (task.param_definitions || []).map((param) => (
      param.read_only ? param : { ...param, value: paramDrafts[param.key] ?? normalizeParamValue(param) }
    ))
    return { ...task, cron, param_definitions: paramDefinitions }
  }, [draftCrons, draftParams])

  const editorTask = useMemo(() => {
    const task = tasks.find((item) => item.name === parameterEditor)
    return task ? applyDraftsToTask(task) : null
  }, [applyDraftsToTask, parameterEditor, tasks])

  const resultTask = useMemo(
    () => tasks.find((task) => task.name === resultViewer) || null,
    [resultViewer, tasks],
  )

  const persist = useCallback(async (
    next: ScheduledTaskInfo[],
    options?: { reloadOnError?: boolean; clearedDrafts?: string[] },
  ) => {
    try {
      const response = await updateScheduledTasks(next.map(buildTaskPayload))
      if (response.data) {
        syncTasks(response.data, options?.clearedDrafts)
      }
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: message })
      if (options?.reloadOnError !== false) {
        void load()
      }
    }
  }, [load, syncTasks])

  const toggleEnabled = (name: string, enabled: boolean) => {
    const next = tasks.map((task) => (task.name === name ? { ...task, enabled } : task))
    setTasks(next)
    void persist(next)
  }

  const updateCron = (name: string, cron: string) => {
    const savedCron = tasks.find((task) => task.name === name)?.cron
    setDraftCrons((prev) => {
      if (savedCron === undefined || cron === savedCron) {
        if (!(name in prev)) return prev
        const next = { ...prev }
        delete next[name]
        return next
      }
      return { ...prev, [name]: cron }
    })
  }

  const updateParam = (taskName: string, key: string, value: string) => {
    const savedParam = tasks.find((task) => task.name === taskName)?.param_definitions?.find((param) => param.key === key)
    const savedValue = savedParam ? normalizeParamValue(savedParam) : ""

    setDraftParams((prev) => {
      const current = prev[taskName] || {}
      if (value === savedValue) {
        if (!(key in current)) return prev
        const nextTask = { ...current }
        delete nextTask[key]
        if (Object.keys(nextTask).length === 0) {
          const next = { ...prev }
          delete next[taskName]
          return next
        }
        return { ...prev, [taskName]: nextTask }
      }

      return {
        ...prev,
        [taskName]: {
          ...current,
          [key]: value,
        },
      }
    })
  }

  const resetToDefault = (taskName: string) => {
    const task = tasks.find((item) => item.name === taskName)
    if (!task) return
    updateCron(taskName, task.default_cron)
  }

  const resetParam = (taskName: string, key: string) => {
    const savedParam = tasks.find((task) => task.name === taskName)?.param_definitions?.find((param) => param.key === key)
    updateParam(taskName, key, savedParam ? normalizeParamValue(savedParam) : "")
  }

  const saveTask = async (taskName: string, options?: { closeEditor?: boolean }) => {
    const currentTask = tasks.find((task) => task.name === taskName)
    if (!currentTask) return

    setSavingTask(taskName)
    try {
      const next = tasks.map((task) => (task.name === taskName ? applyDraftsToTask(task) : task))
      await persist(next, { reloadOnError: false, clearedDrafts: [taskName] })
      if (options?.closeEditor) {
        setParameterEditor((current) => (current === taskName ? null : current))
      }
    } finally {
      setSavingTask((current) => (current === taskName ? null : current))
    }
  }

  const handleRun = async (taskName: string) => {
    setRunningTask(taskName)
    try {
      await runScheduledTask(taskName)
      toast.success("任务已触发", { description: "结果会自动刷新，可在弹窗中查看最近一次执行结果" })
      scheduleRefreshBurst()
    } catch {
      toast.error("触发失败")
    } finally {
      setRunningTask(null)
    }
  }

  const toggleExpand = (taskName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(taskName)) next.delete(taskName)
      else next.add(taskName)
      return next
    })
  }

  const resultData = useMemo(
    () => summarizeResultData(resultTask?.last_execution?.data),
    [resultTask?.last_execution?.data],
  )
  const resultDetail = resultTask?.last_execution?.data?.detail || ""
  const resultStatusMeta = getResultStatusMeta(resultTask?.last_execution)

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" /> 定时任务
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  配置任务周期、参数，并支持在弹窗中查看最近一次执行结果。
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                刷新
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">暂无定时任务</div>
            ) : (
              tasks.map((task) => {
                const hydratedTask = applyDraftsToTask(task)
                const isExpanded = expanded.has(task.name)
                const cronValue = hydratedTask.cron
                const cronDirty = cronValue !== task.cron
                const showCronPresets = editingCron === task.name
                const editableParams = getEditableParamDefinitions(hydratedTask)
                const hasParams = editableParams.length > 0
                const paramSummaries = editableParams.map(formatParamSummary).filter(Boolean)
                const paramsDirty = editableParams.some((param) => {
                  const saved = task.param_definitions?.find((item) => item.key === param.key)
                  return normalizeParamValue(param) !== (saved ? normalizeParamValue(saved) : "")
                })
                const statusMeta = getResultStatusMeta(task.last_execution)
                const unbound = task.enabled && task.requires_webhook && task.bound_webhook_count === 0

                return (
                  <div key={task.name} className={`overflow-hidden rounded-md border ${unbound ? "border-amber-400/70" : ""}`}>
                    <div
                      className={`flex cursor-pointer items-center gap-2 p-2.5 transition-colors hover:bg-muted/50 ${unbound ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                      onClick={() => toggleExpand(task.name)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {task.description}
                          {unbound && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant={task.enabled ? "secondary" : "outline"} className="text-[10px]">
                            {task.enabled ? "启用" : "停用"}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {cronValue}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${statusMeta.className}`}>
                            最近结果: {statusMeta.label}
                          </Badge>
                          {hasParams && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <SlidersHorizontal className="h-3 w-3" /> 参数
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 border-t px-3 pb-3 pt-2">
                            {unbound && (
                              <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>任务已启用，但当前没有有效的 Webhook 绑定，执行时会被跳过。</span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 text-xs text-muted-foreground">
                                <span>事件: </span>
                                {task.event_names && task.event_names.length > 1 ? (
                                  <span className="inline-flex flex-wrap gap-1">
                                    {task.event_names.map((name) => (
                                      <Badge key={name} variant="outline" className="font-mono text-[10px] font-normal">
                                        {name}
                                      </Badge>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="font-mono">{task.event_name}</span>
                                )}
                                {task.next_run && task.enabled && (
                                  <span className="ml-2">| 下次执行: {formatDateTime(task.next_run)}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <Switch checked={task.enabled} onCheckedChange={(value) => toggleEnabled(task.name, value)} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="手动执行"
                                  onClick={() => void handleRun(task.name)}
                                  disabled={runningTask === task.name}
                                >
                                  {runningTask === task.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            </div>

                            <div
                              className="space-y-2"
                              onFocusCapture={() => setEditingCron(task.name)}
                              onBlurCapture={(event) => {
                                const nextFocused = event.relatedTarget
                                if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return
                                setEditingCron((current) => (current === task.name ? null : current))
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs text-muted-foreground">Cron</span>
                                <Input
                                  value={cronValue}
                                  onChange={(event) => updateCron(task.name, event.target.value)}
                                  placeholder="秒 分 时 日 月 周"
                                  className="h-8 font-mono text-xs"
                                />
                                {cronDirty && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-emerald-600 hover:text-emerald-700"
                                    title="保存任务配置"
                                    onClick={() => void saveTask(task.name)}
                                    disabled={savingTask === task.name}
                                  >
                                    {savingTask === task.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                                {cronValue !== task.default_cron && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    title={`恢复默认: ${task.default_cron}`}
                                    onClick={() => resetToDefault(task.name)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>

                              <AnimatePresence initial={false}>
                                {showCronPresets && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 pl-10">
                                      <span className="mr-1 text-[11px] text-muted-foreground">快捷预设</span>
                                      {getCronPresets(task).map((preset) => (
                                        <Button
                                          key={preset.cron}
                                          type="button"
                                          variant={cronValue === preset.cron ? "secondary" : "outline"}
                                          size="sm"
                                          className="h-7 rounded-full px-3 text-[11px] font-normal"
                                          title={preset.cron}
                                          onClick={() => updateCron(task.name, preset.cron)}
                                        >
                                          {preset.label}
                                        </Button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {hasParams && (
                              <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-medium text-foreground">任务参数</div>
                                  <Button
                                    variant={paramsDirty ? "secondary" : "outline"}
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setParameterEditor(task.name)}
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    编辑参数
                                  </Button>
                                </div>
                                {paramSummaries.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {paramSummaries.map((summary) => (
                                      <Badge key={summary} variant="outline" className="max-w-full truncate text-[10px] font-normal">
                                        {summary}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">当前使用默认参数。</div>
                                )}
                              </div>
                            )}

                            <div className="rounded-md border bg-muted/10 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="text-xs font-medium text-foreground">最近一次执行结果</div>
                                  {task.last_execution ? (
                                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                      <span>触发: {task.last_execution.trigger === "manual" ? "手动" : task.last_execution.trigger === "cron" ? "定时" : task.last_execution.trigger || "未知"}</span>
                                      <span>开始: {formatDateTime(task.last_execution.started_at)}</span>
                                      {task.last_execution.duration_ms ? <span>耗时: {formatDurationMs(task.last_execution.duration_ms)}</span> : null}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-muted-foreground">暂无执行记录</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] ${statusMeta.className}`}>
                                    {statusMeta.label}
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setResultViewer(task.name)}
                                    disabled={!task.last_execution}
                                  >
                                    查看结果
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={!!resultTask} onOpenChange={(open) => !open && setResultViewer(null)}>
        <DialogContent className="grid max-h-[min(100dvh-1rem,48rem)] w-[calc(100vw-1rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <DialogTitle>最近一次执行结果</DialogTitle>
                <DialogDescription>{resultTask?.description || "定时任务执行详情"}</DialogDescription>
              </div>
              <Badge variant="outline" className={`text-[10px] ${resultStatusMeta.className}`}>
                {resultStatusMeta.label}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
            {resultTask?.last_execution ? (
              <>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>触发方式: {resultTask.last_execution.trigger === "manual" ? "手动" : resultTask.last_execution.trigger === "cron" ? "定时" : resultTask.last_execution.trigger || "未知"}</span>
                  <span>开始时间: {formatDateTime(resultTask.last_execution.started_at)}</span>
                  {resultTask.last_execution.finished_at && <span>结束时间: {formatDateTime(resultTask.last_execution.finished_at)}</span>}
                  {resultTask.last_execution.duration_ms ? <span>耗时: {formatDurationMs(resultTask.last_execution.duration_ms)}</span> : null}
                </div>

                {resultTask.last_execution.message && (
                  <div className="rounded-md bg-muted/20 px-3 py-2 text-sm text-foreground">
                    {resultTask.last_execution.message}
                  </div>
                )}

                {resultTask.last_execution.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {resultTask.last_execution.error}
                  </div>
                )}

                {resultData.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {resultData.map(([key, value]) => (
                      <div key={key} className="rounded-md border bg-background px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">{formatResultKey(key)}</div>
                        <div className="mt-1 break-words text-xs text-foreground">{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {resultDetail && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">详细结果</div>
                    <Textarea value={resultDetail} readOnly rows={12} className="text-xs leading-5" />
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">暂无执行结果。</div>
            )}
          </div>

          <DialogFooter className="border-t px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setResultViewer(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editorTask} onOpenChange={(open) => !open && setParameterEditor(null)}>
        <DialogContent className="grid max-h-[min(100dvh-1rem,48rem)] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle>编辑任务参数</DialogTitle>
            <DialogDescription>{editorTask?.description}</DialogDescription>
          </DialogHeader>

          {editorTask && (
            <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
              {(editorTask.param_definitions || []).map((param) => {
                const value = normalizeParamValue(param)
                const savedParam = tasks.find((task) => task.name === editorTask.name)?.param_definitions?.find((item) => item.key === param.key)
                const savedValue = savedParam ? normalizeParamValue(savedParam) : ""
                const dirty = !param.read_only && value !== savedValue

                return (
                  <div key={param.key} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{param.label}</div>
                        {param.description && <div className="text-xs text-muted-foreground">{param.description}</div>}
                      </div>
                      {dirty && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="恢复已保存值" onClick={() => resetParam(editorTask.name, param.key)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {param.type === "textarea" && (
                      <Textarea
                        value={value}
                        readOnly={param.read_only}
                        rows={param.rows || 5}
                        placeholder={param.placeholder}
                        onChange={(event) => {
                          if (param.read_only) return
                          updateParam(editorTask.name, param.key, event.target.value)
                        }}
                        className={`text-xs ${param.read_only ? "font-mono bg-muted/40" : ""}`}
                      />
                    )}

                    {param.type === "text" && (
                      <Input
                        value={value}
                        readOnly={param.read_only}
                        placeholder={param.placeholder}
                        onChange={(event) => {
                          if (param.read_only) return
                          updateParam(editorTask.name, param.key, event.target.value)
                        }}
                        className={`h-9 text-xs ${param.read_only ? "font-mono bg-muted/40" : ""}`}
                      />
                    )}

                    {param.type === "number" && (
                      <Input
                        type="number"
                        value={value}
                        readOnly={param.read_only}
                        placeholder={param.placeholder}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        onChange={(event) => {
                          if (param.read_only) return
                          updateParam(editorTask.name, param.key, event.target.value)
                        }}
                        className={`h-9 text-xs ${param.read_only ? "font-mono bg-muted/40" : ""}`}
                      />
                    )}

                    {param.type === "boolean" && (
                      <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                        <div className="text-xs text-muted-foreground">{isBooleanEnabled(value) ? "开启" : "关闭"}</div>
                        <Switch
                          checked={isBooleanEnabled(value)}
                          disabled={param.read_only}
                          onCheckedChange={(checked) => updateParam(editorTask.name, param.key, checked ? "true" : "false")}
                        />
                      </div>
                    )}

                    {param.type === "select" && (
                      <Select value={value} onValueChange={(nextValue) => updateParam(editorTask.name, param.key, nextValue)} disabled={param.read_only}>
                        <SelectTrigger className="w-full text-xs">
                          <SelectValue placeholder={param.placeholder || "请选择"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(param.options || []).map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {param.type === "multi_select" && (
                      <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/20 p-3">
                        {(param.options || []).map((option) => {
                          const selected = value ? value.split(",").filter(Boolean) : []
                          const checked = selected.includes(option.value)
                          return (
                            <Button
                              key={option.value}
                              type="button"
                              variant={checked ? "secondary" : "outline"}
                              size="sm"
                              className="rounded-full text-xs font-normal"
                              disabled={param.read_only}
                              onClick={() => {
                                const next = checked ? selected.filter((item) => item !== option.value) : [...selected, option.value]
                                updateParam(editorTask.name, param.key, next.join(","))
                              }}
                            >
                              {checked && <Check className="mr-1 h-3 w-3" />}
                              {option.label}
                            </Button>
                          )
                        })}
                      </div>
                    )}

                    {param.type === "map" && (() => {
                      let entries: Array<[string, string]> = []
                      try {
                        entries = Object.entries(value ? JSON.parse(value) : {})
                      } catch {
                        entries = []
                      }

                      const updateEntries = (next: Array<[string, string]>) => {
                        updateParam(editorTask.name, param.key, JSON.stringify(Object.fromEntries(next)))
                      }

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex-1">{param.map_key_label || "键"}</span>
                            <span className="flex-1">{param.map_value_label || "值"}</span>
                            <span className="w-8" />
                          </div>

                          {entries.map(([key, mapValue], index) => (
                            <div key={`${key}-${index}`} className="flex items-center gap-2">
                              <Input
                                value={key}
                                className="h-8 flex-1 text-xs"
                                placeholder={param.map_key_label || "键"}
                                onChange={(event) => {
                                  const next = [...entries]
                                  next[index] = [event.target.value, mapValue]
                                  updateEntries(next)
                                }}
                              />
                              <Input
                                value={mapValue}
                                className="h-8 flex-1 text-xs"
                                placeholder={param.map_value_label || "值"}
                                onChange={(event) => {
                                  const next = [...entries]
                                  next[index] = [key, event.target.value]
                                  updateEntries(next)
                                }}
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateEntries(entries.filter((_, itemIndex) => itemIndex !== index))}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}

                          <Button variant="outline" size="sm" className="gap-1" onClick={() => updateEntries([...entries, ["", ""]])}>
                            <Plus className="h-3.5 w-3.5" /> 添加
                          </Button>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter className="border-t px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setParameterEditor(null)}>
              关闭
            </Button>
            <Button onClick={() => editorTask && void saveTask(editorTask.name, { closeEditor: true })} disabled={!editorTask || savingTask === editorTask.name}>
              {editorTask && savingTask === editorTask.name ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存参数"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
