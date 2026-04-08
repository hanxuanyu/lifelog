import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Plus, Trash2, Play, AlertTriangle, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface BindingRow {
  event: string
  webhook_name: string
  enabled: boolean
  isNew?: boolean
}

export function EventBindingsCard() {
  const [events, setEvents] = useState<EventDefinition[]>([])
  const [bindings, setBindings] = useState<BindingRow[]>([])
  const [origBindings, setOrigBindings] = useState<BindingRow[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newEvent, setNewEvent] = useState("")
  const [newWebhook, setNewWebhook] = useState("")

  useEffect(() => {
    Promise.all([getEvents(), getEventBindings(), getWebhooks()])
      .then(([evts, binds, whs]) => {
        setEvents(evts || [])
        setWebhooks(whs || [])
        const rows = (binds || []).map(b => ({ ...b }))
        setBindings(rows)
        setOrigBindings(JSON.parse(JSON.stringify(rows)))
      })
      .catch(() => {})
  }, [])

  const dirty = JSON.stringify(bindings.map(({ isNew: _, ...b }) => b)) !== JSON.stringify(origBindings)

  const getEventDef = (name: string) => events.find(e => e.name === name)
  const getWebhookDef = (name: string) => webhooks.find(w => w.name === name)

  // 变量匹配校验：返回 webhook 中使用了但事件未提供的变量
  const getUnmatchedVars = (eventName: string, webhookName: string) => {
    const def = getEventDef(eventName)
    const wh = getWebhookDef(webhookName)
    if (!def || !wh) return []
    const eventKeys = new Set(def.variables.map(v => v.key))
    const used = extractPlaceholders(wh)
    return [...used].filter(k => !eventKeys.has(k))
  }

  const addBinding = () => {
    if (!newEvent || !newWebhook) {
      toast.error("请选择事件和 Webhook")
      return
    }
    if (bindings.some(b => b.event === newEvent && b.webhook_name === newWebhook)) {
      toast.error("该绑定已存在")
      return
    }
    setBindings(prev => [...prev, { event: newEvent, webhook_name: newWebhook, enabled: true, isNew: true }])
    setNewEvent("")
    setNewWebhook("")
    setAdding(false)
  }

  const removeBinding = (idx: number) => {
    setBindings(prev => prev.filter((_, i) => i !== idx))
  }

  const toggleEnabled = (idx: number, val: boolean) => {
    setBindings(prev => prev.map((b, i) => i === idx ? { ...b, enabled: val } : b))
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: EventBinding[] = bindings.map(({ isNew: _, ...b }) => b)
      await updateEventBindings(payload)
      const saved = payload.map(b => ({ ...b }))
      setBindings(saved)
      setOrigBindings(JSON.parse(JSON.stringify(saved)))
      toast.success("事件绑定已保存")
    } catch { toast.error("保存失败") }
    finally { setSaving(false) }
  }

  // 当前选中事件的变量列表（用于添加绑定时预览）
  const newEventDef = getEventDef(newEvent)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> 事件绑定
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)} disabled={adding}>
              <Plus className="h-3 w-3 mr-1" />添加绑定
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 添加绑定表单 */}
          <AnimatePresence>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">事件</span>
                      <Select value={newEvent || NONE_VALUE} onValueChange={v => setNewEvent(v === NONE_VALUE ? "" : v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择事件" /></SelectTrigger>
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
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择 Webhook" /></SelectTrigger>
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
                    <div className="flex flex-wrap gap-1.5">
                      {newEventDef.variables.map(v => (
                        <Badge key={v.key} variant="outline" className="text-xs font-mono">
                          {`{{${v.key}}}`} <span className="ml-1 font-normal text-muted-foreground">{v.description}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* 变量匹配警告 */}
                  {newEvent && newWebhook && (() => {
                    const unmatched = getUnmatchedVars(newEvent, newWebhook)
                    return unmatched.length > 0 ? (
                      <div className="flex items-start gap-1.5 text-xs text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap items-center gap-1">
                          <span>未匹配变量:</span>
                          {unmatched.map(k => (
                            <Badge key={k} variant="outline" className="text-xs font-mono border-amber-500 text-amber-600 bg-amber-100/50 dark:bg-amber-900/30">
                              {`{{${k}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={addBinding}>确认添加</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setNewEvent(""); setNewWebhook("") }}>取消</Button>
                  </div>
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
                <div key={`${b.event}-${b.webhook_name}`} className={`border rounded-md p-2.5 space-y-1.5 ${unmatched.length > 0 ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{b.event}</div>
                      {def && <div className="text-xs text-muted-foreground truncate">{def.description}</div>}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{b.webhook_name}</Badge>
                    <Switch checked={b.enabled} onCheckedChange={v => toggleEnabled(idx, v)} className="shrink-0" />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleTest(b.webhook_name, b.event)} disabled={testing === testKey}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-destructive" onClick={() => removeBinding(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {unmatched.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap items-center gap-1">
                        <span>未匹配变量:</span>
                        {unmatched.map(k => (
                          <Badge key={k} variant="outline" className="text-xs font-mono border-amber-500 text-amber-600 bg-amber-100/50 dark:bg-amber-900/30">
                            {`{{${k}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* 保存按钮 */}
          <AnimatePresence>
            {dirty && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  <Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存绑定"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}