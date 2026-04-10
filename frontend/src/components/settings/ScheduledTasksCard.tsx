import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { getScheduledTasks, updateScheduledTasks, runScheduledTask } from "@/api"
import { toast } from "sonner"
import type { ScheduledTaskInfo } from "@/types"

const commonCronPresets = [
  { label: "\u6bcf30\u5206\u949f", cron: "0 */30 * * * *" },
  { label: "\u6bcf\u5c0f\u65f6", cron: "0 0 * * * *" },
  { label: "\u6bcf\u5929 09:00", cron: "0 0 9 * * *" },
  { label: "\u5de5\u4f5c\u65e5 09:00", cron: "0 0 9 * * 1-5" },
  { label: "\u6bcf\u5468\u4e00 09:00", cron: "0 0 9 * * 1" },
  { label: "\u6bcf\u67081\u65e5 09:00", cron: "0 0 9 1 * *" },
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
  const presets = [{ label: "\u9ed8\u8ba4\u63a8\u8350", cron: task.default_cron }, ...commonCronPresets]
  const seen = new Set<string>()
  return presets.filter((preset) => {
    if (seen.has(preset.cron)) return false
    seen.add(preset.cron)
    return true
  })
}

export function ScheduledTasksCard() {
  const [tasks, setTasks] = useState<ScheduledTaskInfo[]>([])
  const [draftCrons, setDraftCrons] = useState<Record<string, string>>({})
  const [editingCron, setEditingCron] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [savingCron, setSavingCron] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
  }, [])

  const load = useCallback(() => {
    getScheduledTasks()
      .then((list) => syncTasks(list || []))
      .catch(() => toast.error("加载定时任务失败"))
  }, [syncTasks])

  useEffect(() => {
    void load()
  }, [load])

  const persist = useCallback(async (
    next: ScheduledTaskInfo[],
    options?: { reloadOnError?: boolean; clearedDrafts?: string[] },
  ) => {
    try {
      const payload = next.map((task) => ({
        name: task.name,
        cron: task.cron,
        enabled: task.enabled,
      }))
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

  const saveCron = async (name: string) => {
    const task = tasks.find((item) => item.name === name)
    const cron = draftCrons[name]
    if (!task || cron === undefined || cron === task.cron) return

    setSavingCron(name)
    try {
      const next = tasks.map((item) => item.name === name ? { ...item, cron } : item)
      await persist(next, { reloadOnError: false, clearedDrafts: [name] })
    } finally {
      setSavingCron((current) => current === name ? null : current)
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> 定时任务
          </CardTitle>
          <CardDescription className="text-xs">
            内置定时任务按 cron 表达式自动执行，结果会发布为事件，可绑定到 Webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">暂无定时任务</div>
          ) : (
            tasks.map((task) => {
              const isExpanded = expanded.has(task.name)
              const cronValue = draftCrons[task.name] ?? task.cron
              const cronDirty = cronValue !== task.cron
              const showCronPresets = editingCron === task.name
              const presets = getCronPresets(task)
              const unbound = task.enabled && task.bound_webhook_count === 0

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
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                          {unbound && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>
                                任务已启用但未绑定 Webhook，执行时将跳过。请在上方“事件绑定”中将
                                <span className="font-mono">{task.event_name}</span>
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
                                placeholder="\u79d2 \u5206 \u65f6 \u65e5 \u6708 \u5468"
                                className="h-7 text-xs font-mono"
                              />
                              {cronDirty && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-emerald-600 hover:text-emerald-700"
                                  title="保存 Cron"
                                  aria-label={`保存 ${task.description} 的 Cron`}
                                  onClick={() => saveCron(task.name)}
                                  disabled={savingCron === task.name}
                                >
                                  {savingCron === task.name
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
                                    <span className="text-[11px] text-muted-foreground mr-1">\u5feb\u901f\u9884\u8bbe</span>
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
  )
}
