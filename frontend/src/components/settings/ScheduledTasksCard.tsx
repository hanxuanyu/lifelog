import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
  SlidersHorizontal,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getScheduledTasks, updateScheduledTasks, runScheduledTask } from "@/api"
import { toast } from "sonner"
import type { ScheduledTaskInfo, ScheduledTaskParamDefinition } from "@/types"

const commonCronPresets = [
  { label: "每30分钟", cron: "0 */30 * * * *" },
  { label: "每小时", cron: "0 0 * * * *" },
  { label: "每天 09:00", cron: "0 0 9 * * *" },
  { label: "工作日 09:00", cron: "0 0 9 * * 1-5" },
  { label: "每周一 09:00", cron: "0 0 9 * * 1" },
  { label: "每月1日 09:00", cron: "0 0 9 1 * *" },
]

function formatNextRun(ts?: string): string {
  if (!ts) return ""
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString()
  } catch {
    return ""
  }
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

function getEditableParamValues(task: ScheduledTaskInfo) {
  return Object.fromEntries(
    getEditableParamDefinitions(task).map((param) => [param.key, normalizeParamValue(param)]),
  )
}

function normalizeParamValue(param: ScheduledTaskParamDefinition) {
  if (param.type === "boolean") {
    return param.value === "true" ? "true" : "false"
  }
  return param.value?.trim() || ""
}

function buildTaskPayload(task: ScheduledTaskInfo) {
  const params = Object.fromEntries(
    getEditableParamDefinitions(task)
      .map((param) => [param.key, normalizeParamValue(param)] as const)
      .filter(([_, value]) => value !== "" && value !== "false"),
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
    return `${param.label}：${isBooleanEnabled(value) ? "开启" : "关闭"}`
  }
  if (!value) return ""
  if (param.key === "custom_prompt") {
    return `${param.label}：${value.length > 24 ? `${value.slice(0, 24)}...` : value}`
  }
  return `${param.label}：${value}`
}

export function ScheduledTasksCard() {
  const [tasks, setTasks] = useState<ScheduledTaskInfo[]>([])
  const [draftCrons, setDraftCrons] = useState<Record<string, string>>({})
  const [draftParams, setDraftParams] = useState<Record<string, Record<string, string>>>({})
  const [editingCron, setEditingCron] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [savingTask, setSavingTask] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [parameterEditor, setParameterEditor] = useState<string | null>(null)
  const parameterEditorBodyRef = useRef<HTMLDivElement | null>(null)
  const firstEditableFieldRef = useRef<HTMLElement | null>(null)
  const focusedEditorFieldRef = useRef<HTMLElement | null>(null)

  const syncTasks = useCallback((next: ScheduledTaskInfo[], clearedDrafts: string[] = []) => {
    setTasks(next)

    setDraftCrons((prev) => {
      const cronByName = new Map(next.map((task) => [task.name, task.cron]))
      const cleared = new Set(clearedDrafts)
      let changed = false
      const filtered: Record<string, string> = {}

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
      const paramValuesByTask = new Map(next.map((task) => [task.name, getEditableParamValues(task)]))
      const cleared = new Set(clearedDrafts)
      let changed = false
      const filtered: Record<string, Record<string, string>> = {}

      for (const [taskName, values] of Object.entries(prev)) {
        if (cleared.has(taskName)) {
          changed = true
          continue
        }

        const savedValues = paramValuesByTask.get(taskName)
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

  const load = useCallback(() => {
    getScheduledTasks()
      .then((list) => syncTasks(list || []))
      .catch(() => toast.error("加载定时任务失败"))
  }, [syncTasks])

  useEffect(() => {
    void load()
  }, [load])

  const scrollEditorFieldIntoView = useCallback((target?: HTMLElement | null, behavior: ScrollBehavior = "smooth") => {
    if (!target) return
    focusedEditorFieldRef.current = target

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior, block: "center", inline: "nearest" })
      }, 120)
    })
  }, [])

  useEffect(() => {
    if (!parameterEditor) return

    const viewport = window.visualViewport
    if (!viewport) return

    const handleViewportChange = () => {
      scrollEditorFieldIntoView(focusedEditorFieldRef.current, "auto")
    }

    viewport.addEventListener("resize", handleViewportChange)
    viewport.addEventListener("scroll", handleViewportChange)
    return () => {
      viewport.removeEventListener("resize", handleViewportChange)
      viewport.removeEventListener("scroll", handleViewportChange)
    }
  }, [parameterEditor, scrollEditorFieldIntoView])

  useEffect(() => {
    if (parameterEditor) return
    firstEditableFieldRef.current = null
    focusedEditorFieldRef.current = null
  }, [parameterEditor])

  const persist = useCallback(async (
    next: ScheduledTaskInfo[],
    options?: { reloadOnError?: boolean; clearedDrafts?: string[] },
  ) => {
    try {
      const payload = next.map(buildTaskPayload)
      const res = await updateScheduledTasks(payload)
      if (res.data) {
        syncTasks(res.data, options?.clearedDrafts)
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
      if (options?.reloadOnError !== false) {
        void load()
      }
    }
  }, [load, syncTasks])

  const applyDraftsToTask = useCallback((task: ScheduledTaskInfo): ScheduledTaskInfo => {
    const cron = draftCrons[task.name] ?? task.cron
    const paramDrafts = draftParams[task.name] || {}
    const paramDefinitions = (task.param_definitions || []).map((param) => (
      param.read_only
        ? param
        : { ...param, value: paramDrafts[param.key] ?? normalizeParamValue(param) }
    ))

    return { ...task, cron, param_definitions: paramDefinitions }
  }, [draftCrons, draftParams])

  const editorTask = useMemo(
    () => tasks.find((task) => task.name === parameterEditor) ? applyDraftsToTask(tasks.find((task) => task.name === parameterEditor)!) : null,
    [applyDraftsToTask, parameterEditor, tasks],
  )

  const toggleEnabled = (name: string, val: boolean) => {
    const next = tasks.map((task) => task.name === name ? { ...task, enabled: val } : task)
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

  const resetToDefault = (name: string) => {
    const task = tasks.find((item) => item.name === name)
    if (!task) return
    updateCron(name, task.default_cron)
  }

  const updateParam = (taskName: string, key: string, value: string) => {
    const task = tasks.find((item) => item.name === taskName)
    const savedValue = task?.param_definitions?.find((param) => param.key === key)
    const normalizedSavedValue = savedValue ? normalizeParamValue(savedValue) : ""

    setDraftParams((prev) => {
      const currentTaskDrafts = prev[taskName] || {}
      if (value === normalizedSavedValue) {
        if (!(key in currentTaskDrafts)) return prev
        const nextTaskDrafts = { ...currentTaskDrafts }
        delete nextTaskDrafts[key]
        if (Object.keys(nextTaskDrafts).length === 0) {
          const next = { ...prev }
          delete next[taskName]
          return next
        }
        return { ...prev, [taskName]: nextTaskDrafts }
      }

      return {
        ...prev,
        [taskName]: {
          ...currentTaskDrafts,
          [key]: value,
        },
      }
    })
  }

  const resetParam = (taskName: string, key: string) => {
    const savedParam = tasks
      .find((task) => task.name === taskName)
      ?.param_definitions
      ?.find((param) => param.key === key)
    updateParam(taskName, key, savedParam ? normalizeParamValue(savedParam) : "")
  }

  const saveTask = async (name: string, options?: { closeEditor?: boolean }) => {
    const currentTask = tasks.find((task) => task.name === name)
    if (!currentTask) return

    setSavingTask(name)
    try {
      const next = tasks.map((task) => task.name === name ? applyDraftsToTask(task) : task)
      await persist(next, { reloadOnError: false, clearedDrafts: [name] })
      if (options?.closeEditor) {
        setParameterEditor((current) => current === name ? null : current)
      }
    } finally {
      setSavingTask((current) => current === name ? null : current)
    }
  }

  const handleRun = async (name: string) => {
    setRunning(name)
    try {
      await runScheduledTask(name)
      toast.success("任务已触发，将异步执行")
    } catch {
      toast.error("触发失败")
    } finally {
      setRunning(null)
    }
  }

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> 定时任务
            </CardTitle>
            <CardDescription className="text-xs">
              配置内置任务的执行周期、事件触发和任务参数。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">暂无定时任务</div>
            ) : (
              tasks.map((task) => {
                const isExpanded = expanded.has(task.name)
                const hydratedTask = applyDraftsToTask(task)
                const cronValue = hydratedTask.cron
                const cronDirty = cronValue !== task.cron
                const showCronPresets = editingCron === task.name
                const presets = getCronPresets(task)
                const editableParams = getEditableParamDefinitions(hydratedTask)
                const paramsDirty = editableParams.some((param) => {
                  const saved = task.param_definitions?.find((item) => item.key === param.key)
                  return normalizeParamValue(param) !== (saved ? normalizeParamValue(saved) : "")
                })
                const hasParams = (hydratedTask.param_definitions || []).length > 0
                const unbound = task.enabled && task.bound_webhook_count === 0
                const paramSummaries = editableParams
                  .map(formatParamSummary)
                  .filter(Boolean)

                return (
                  <div key={task.name} className={`border rounded-md overflow-hidden ${unbound ? "border-amber-500/50" : ""}`}>
                    <div
                      className={`flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${unbound ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                      onClick={() => toggleExpand(task.name)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {task.description}
                          {unbound && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        </div>
                      </div>
                      {hasParams && (
                        <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                          <SlidersHorizontal className="h-3 w-3" /> 参数
                        </Badge>
                      )}
                      <Badge variant={task.enabled ? "secondary" : "outline"} className="text-[10px] shrink-0">
                        {task.enabled ? "启用" : "停用"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        {cronValue}
                      </Badge>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
                            {unbound && (
                              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>
                                  任务已启用但未绑定 Webhook，执行时将跳过。请在上方“事件绑定”中将
                                  <span className="font-mono"> {task.event_name} </span>
                                  绑定到 Webhook。
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground min-w-0">
                                <span>事件：</span>
                                <span className="font-mono">{task.event_name}</span>
                                {task.next_run && task.enabled && (
                                  <span className="ml-2">| 下次执行：{formatNextRun(task.next_run)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Switch
                                  checked={task.enabled}
                                  onCheckedChange={(value) => toggleEnabled(task.name, value)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="手动执行"
                                  onClick={() => handleRun(task.name)}
                                  disabled={running === task.name}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div
                              className="space-y-2"
                              onFocusCapture={() => setEditingCron(task.name)}
                              onBlurCapture={(e) => {
                                const nextFocused = e.relatedTarget
                                if (nextFocused instanceof Node && e.currentTarget.contains(nextFocused)) {
                                  return
                                }
                                setEditingCron((current) => current === task.name ? null : current)
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">Cron</span>
                                <Input
                                  value={cronValue}
                                  onChange={(e) => updateCron(task.name, e.target.value)}
                                  placeholder="秒 分 时 日 月 周"
                                  className="h-7 text-xs font-mono"
                                />
                                {cronDirty && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-emerald-600 hover:text-emerald-700"
                                    title="保存任务配置"
                                    aria-label={`保存 ${task.description} 的配置`}
                                    onClick={() => saveTask(task.name)}
                                    disabled={savingTask === task.name}
                                  >
                                    {savingTask === task.name
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Check className="h-3.5 w-3.5" />
                                    }
                                  </Button>
                                )}
                                {cronValue !== task.default_cron && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0"
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
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pl-10 flex flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] text-muted-foreground mr-1">快速预设</span>
                                      {presets.map((preset) => (
                                        <Button
                                          key={preset.cron}
                                          type="button"
                                          variant={cronValue === preset.cron ? "secondary" : "outline"}
                                          size="xs"
                                          className="rounded-full font-normal"
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
                              <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
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
                                  <div className="text-[11px] text-muted-foreground">
                                    使用默认参数配置。
                                  </div>
                                )}
                              </div>
                            )}
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

      <Dialog open={!!editorTask} onOpenChange={(open) => !open && setParameterEditor(null)}>
        <DialogContent
          className="grid h-[min(100dvh-1rem,48rem)] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            requestAnimationFrame(() => {
              const target = firstEditableFieldRef.current
              if (!target) return
              target.focus()
              scrollEditorFieldIntoView(target, "auto")
            })
          }}
        >
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle>编辑任务参数</DialogTitle>
            <DialogDescription>
              {editorTask?.description}
            </DialogDescription>
          </DialogHeader>

          {editorTask && (
            <div
              ref={parameterEditorBodyRef}
              className="space-y-4 overflow-y-auto px-5 pb-5 pr-4 pt-1 sm:px-6 sm:pb-6"
              style={{ scrollPaddingBlock: "8rem" }}
            >
              {(editorTask.param_definitions || []).map((param, index, definitions) => {
                const value = normalizeParamValue(param)
                const savedParam = tasks
                  .find((task) => task.name === editorTask.name)
                  ?.param_definitions
                  ?.find((item) => item.key === param.key)
                const savedValue = savedParam ? normalizeParamValue(savedParam) : ""
                const dirty = !param.read_only && value !== savedValue
                const firstEditableIndex = definitions.findIndex((item) => !item.read_only)
                const shouldAutofocus = !param.read_only && index === firstEditableIndex

                return (
                  <div key={param.key} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{param.label}</div>
                        {param.description && (
                          <div className="text-xs text-muted-foreground">{param.description}</div>
                        )}
                      </div>
                      {dirty && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="恢复已保存值"
                          onClick={() => resetParam(editorTask.name, param.key)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {param.type === "textarea" && (
                      <Textarea
                        ref={(node) => {
                          if (shouldAutofocus) {
                            firstEditableFieldRef.current = node
                          }
                        }}
                        value={value}
                        readOnly={param.read_only}
                        rows={param.rows || 5}
                        placeholder={param.placeholder}
                        onFocus={(e) => scrollEditorFieldIntoView(e.currentTarget)}
                        onChange={(e) => {
                          if (param.read_only) return
                          updateParam(editorTask.name, param.key, e.target.value)
                        }}
                        className={`text-xs ${param.read_only ? "font-mono bg-muted/40" : ""}`}
                      />
                    )}

                    {param.type === "text" && (
                      <Input
                        ref={(node) => {
                          if (shouldAutofocus) {
                            firstEditableFieldRef.current = node
                          }
                        }}
                        value={value}
                        readOnly={param.read_only}
                        placeholder={param.placeholder}
                        onFocus={(e) => scrollEditorFieldIntoView(e.currentTarget)}
                        onChange={(e) => {
                          if (param.read_only) return
                          updateParam(editorTask.name, param.key, e.target.value)
                        }}
                        className={`h-9 text-xs ${param.read_only ? "font-mono bg-muted/40" : ""}`}
                      />
                    )}

                    {param.type === "boolean" && (
                      <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          {isBooleanEnabled(value) ? "开启" : "关闭"}
                        </div>
                        <Switch
                          ref={(node) => {
                            if (shouldAutofocus) {
                              firstEditableFieldRef.current = node
                            }
                          }}
                          checked={isBooleanEnabled(value)}
                          disabled={param.read_only}
                          onFocus={(e) => scrollEditorFieldIntoView(e.currentTarget)}
                          onCheckedChange={(checked) => updateParam(editorTask.name, param.key, checked ? "true" : "false")}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter className="border-t px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setParameterEditor(null)}>
              关闭
            </Button>
            <Button
              onClick={() => editorTask && saveTask(editorTask.name, { closeEditor: true })}
              disabled={!editorTask || savingTask === editorTask.name}
            >
              {editorTask && savingTask === editorTask.name
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "保存参数"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
