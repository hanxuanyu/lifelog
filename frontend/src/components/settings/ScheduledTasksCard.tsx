import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Play, RotateCcw, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { getScheduledTasks, updateScheduledTasks, runScheduledTask } from "@/api"
import { toast } from "sonner"
import type { ScheduledTaskInfo } from "@/types"

function formatNextRun(ts?: string): string {
  if (!ts) return ""
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString()
  } catch { return "" }
}

export function ScheduledTasksCard() {
  const [tasks, setTasks] = useState<ScheduledTaskInfo[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = () => {
    getScheduledTasks()
      .then((list) => setTasks(list || []))
      .catch(() => toast.error("加载定时任务失败"))
  }

  useEffect(() => { load() }, [])

  const persist = useCallback(async (next: ScheduledTaskInfo[]) => {
    try {
      const payload = next.map(t => ({ name: t.name, cron: t.cron, enabled: t.enabled }))
      const res = await updateScheduledTasks(payload)
      if (res.data) {
        setTasks(res.data)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
      load()
    }
  }, [])

  const toggleEnabled = (name: string, val: boolean) => {
    const next = tasks.map(t => t.name === name ? { ...t, enabled: val } : t)
    setTasks(next)
    persist(next)
  }

  const updateCron = (name: string, cron: string) => {
    const next = tasks.map(t => t.name === name ? { ...t, cron } : t)
    setTasks(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => persist(next), 800)
  }

  const resetToDefault = (name: string) => {
    const task = tasks.find(t => t.name === name)
    if (!task || task.cron === task.default_cron) return
    const next = tasks.map(t => t.name === name ? { ...t, cron: t.default_cron } : t)
    setTasks(next)
    persist(next)
  }

  const handleRun = async (name: string) => {
    setRunning(name)
    try {
      await runScheduledTask(name)
      toast.success("任务已触发，将异步执行")
    } catch { toast.error("触发失败") }
    finally { setRunning(null) }
  }

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
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
            tasks.map(task => {
              const isExpanded = expanded.has(task.name)
              const unbound = task.enabled && task.bound_webhook_count === 0
              return (
                <div key={task.name} className={`border rounded-md overflow-hidden ${unbound ? "border-amber-500/50" : ""}`}>
                  {/* 折叠头部 */}
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
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">{task.cron}</Badge>
                  </div>
                  {/* 折叠内容 */}
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
                              <span>任务已启用但未绑定 Webhook，执行时将跳过。请在上方「事件绑定」中将 <span className="font-mono">{task.event_name}</span> 绑定到 Webhook。</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground min-w-0">
                              <span>事件：</span><span className="font-mono">{task.event_name}</span>
                              {task.next_run && task.enabled && (
                                <span className="ml-2">| 下次执行：{formatNextRun(task.next_run)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Switch
                                checked={task.enabled}
                                onCheckedChange={(v) => toggleEnabled(task.name, v)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="手动执行"
                                onClick={() => handleRun(task.name)}
                                disabled={running === task.name}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">Cron</span>
                            <Input
                              value={task.cron}
                              onChange={(e) => updateCron(task.name, e.target.value)}
                              placeholder="分 时 日 月 周"
                              className="h-7 text-xs font-mono"
                            />
                            {task.cron !== task.default_cron && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 shrink-0"
                                title={`恢复默认: ${task.default_cron}`}
                                onClick={() => resetToDefault(task.name)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
