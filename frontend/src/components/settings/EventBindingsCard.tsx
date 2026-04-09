import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Plus, Trash2, Play, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getEvents, getEventBindings, getWebhooks, updateEventBindings, testWebhook } from "@/api"
import { toast } from "sonner"
import type { EventDefinition, EventBinding, Webhook } from "@/types"

const NONE_VALUE = "__none__"

// 提取 webhook 中使用的 {{key}} 占位符
function extractPlaceholders(wh: Webhook): Set<string> {
  const re = /\{\{(\w+)\}\}/g
  const sources = [wh.url, wh.body, ...Object.values(wh.headers || {}), ...Object.values(wh.query_params || {})]
  const keys = new Set<string>()
  for (const s of sources) {
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) keys.add(m[1])
  }
  return keys
}

export function EventBindingsCard() {
  const [events, setEvents] = useState<EventDefinition[]>([])
  const [bindings, setBindings] = useState<EventBinding[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newEvent, setNewEvent] = useState("")
  const [newWebhook, setNewWebhook] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{ idx: number; event: string; webhook: string } | null>(null)

  const load = () => {
    Promise.all([getEvents(), getEventBindings(), getWebhooks()])
      .then(([evts, binds, whs]) => {
        setEvents(evts || [])
        setWebhooks(whs || [])
        setBindings(binds || [])
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  const getEventDef = (name: string) => events.find(e => e.name === name)
  const getWebhookDef = (name: string) => webhooks.find(w => w.name === name)

  const resetAddingForm = () => {
    setAdding(false)
    setNewEvent("")
    setNewWebhook("")
  }

  // 变量匹配校验
  const getUnmatchedVars = (eventName: string, webhookName: string) => {
    const def = getEventDef(eventName)
    const wh = getWebhookDef(webhookName)
    if (!def || !wh) return []
    const eventKeys = new Set(def.variables.map(v => v.key))
    const used = extractPlaceholders(wh)
    return [...used].filter(k => !eventKeys.has(k))
  }

  // 持久化当前绑定列表到后端
  const persist = async (next: EventBinding[]) => {
    try {
      await updateEventBindings(next)
      setBindings(next)
    } catch {
      toast.error("保存失败")
      load() // 回滚到服务端状态
    }
  }

  const addBinding = async () => {
    if (!newEvent || !newWebhook) {
      toast.error("请选择事件和 Webhook")
      return
    }
    if (bindings.some(b => b.event === newEvent && b.webhook_name === newWebhook)) {
      toast.error("该绑定已存在")
      return
    }
    const next = [...bindings, { event: newEvent, webhook_name: newWebhook, enabled: true }]
    await persist(next)
    toast.success("绑定已添加")
    resetAddingForm()
  }

  const confirmRemove = async () => {
    if (!deleteTarget) return
    const next = bindings.filter((_, i) => i !== deleteTarget.idx)
    await persist(next)
    toast.success("绑定已删除")
    setDeleteTarget(null)
  }

  const toggleEnabled = async (idx: number, val: boolean) => {
    const next = bindings.map((b, i) => i === idx ? { ...b, enabled: val } : b)
    await persist(next)
  }

  const handleTest = async (webhookName: string, eventName: string) => {
    const key = `${eventName}|${webhookName}`
    setTesting(key)
    try {
      const res = await testWebhook(webhookName, eventName)
      if (res.code === 200) toast.success("测试成功")
      else toast.error(res.message)
    } catch { toast.error("测试失败") }
    finally { setTesting(null) }
  }

  // 当前选中事件的变量列表（用于添加绑定时预览）
  const newEventDef = getEventDef(newEvent)

  const renderUnmatchedWarning = (unmatched: string[]) => (
    <div className="rounded-md border border-amber-500/40 bg-amber-50/70 p-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">以下变量在当前事件中找不到：</p>
          <div className="flex flex-wrap gap-1">
            {unmatched.map(k => (
              <Badge key={k} variant="outline" className="text-xs font-mono border-amber-500 text-amber-700 bg-amber-100/60 dark:bg-amber-900/30 dark:text-amber-300">
                {`{{${k}}}`}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" /> 事件绑定
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                将事件发送到目标 Webhook，并在绑定前检查变量是否匹配
              </CardDescription>
            </div>
            <Button size="xs" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setAdding(true)} disabled={adding}>
              <Plus className="h-3 w-3 mr-1" />添加绑定
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 添加绑定表单 */}
          <AnimatePresence>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-md border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">新建事件绑定</p>
                    <div className="flex items-center gap-1.5">
                      <Button size="xs" variant="ghost" className="h-7 px-2 text-[11px]" onClick={resetAddingForm}>取消</Button>
                      <Button size="xs" className="h-7 px-2 text-[11px]" onClick={addBinding}>确认添加</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">事件</span>
                      <Select value={newEvent || NONE_VALUE} onValueChange={v => setNewEvent(v === NONE_VALUE ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="选择事件" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>选择事件</SelectItem>
                          {events.map(e => (
                            <SelectItem key={e.name} value={e.name}>{e.name} - {e.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Webhook</span>
                      <Select value={newWebhook || NONE_VALUE} onValueChange={v => setNewWebhook(v === NONE_VALUE ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="选择 Webhook" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>选择 Webhook</SelectItem>
                          {webhooks.map(wh => (
                            <SelectItem key={wh.name} value={wh.name}>{wh.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 事件变量预览 */}
                  {newEventDef && newEventDef.variables.length > 0 && (
                    <div className="rounded-md border bg-background/80 p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">事件变量</span>
                        <span className="text-[11px] text-muted-foreground">{newEventDef.variables.length} 个可用变量</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {newEventDef.variables.map(v => (
                          <Badge key={v.key} variant="outline" className="h-auto items-start px-1.5 py-0.5 text-xs font-mono whitespace-normal">
                            {`{{${v.key}}}`} <span className="ml-1 font-normal text-muted-foreground">{v.description}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 变量匹配警告 */}
                  {newEvent && newWebhook && (() => {
                    const unmatched = getUnmatchedVars(newEvent, newWebhook)
                    return unmatched.length > 0 ? renderUnmatchedWarning(unmatched) : null
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 绑定列表 */}
          {bindings.length === 0 && !adding ? (
            <div className="text-sm text-muted-foreground text-center py-4">暂无事件绑定，点击上方按钮添加</div>
          ) : (
            bindings.map((b, idx) => {
              const def = getEventDef(b.event)
              const unmatched = getUnmatchedVars(b.event, b.webhook_name)
              const testKey = `${b.event}|${b.webhook_name}`
              return (
                <div key={`${b.event}-${b.webhook_name}`} className={`rounded-md border p-2.5 space-y-1.5 ${unmatched.length > 0 ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium shrink-0">{b.event}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">→</span>
                      <Badge variant="outline" className="text-[11px] shrink-0">{b.webhook_name}</Badge>
                      {!b.enabled && <Badge variant="outline" className="text-[11px] text-muted-foreground shrink-0">已停用</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch checked={b.enabled} onCheckedChange={v => toggleEnabled(idx, v)} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => handleTest(b.webhook_name, b.event)}
                        disabled={testing === testKey}
                        title="测试"
                        aria-label={`测试 ${b.event} 到 ${b.webhook_name}`}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ idx, event: b.event, webhook: b.webhook_name })}
                        title="删除"
                        aria-label={`删除 ${b.event} 到 ${b.webhook_name} 的绑定`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {def && <div className="text-xs text-muted-foreground">{def.description}</div>}
                  {unmatched.length > 0 && renderUnmatchedWarning(unmatched)}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除事件绑定「{deleteTarget?.event} → {deleteTarget?.webhook}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-white hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
