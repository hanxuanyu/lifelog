import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Save, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getEvents, getEventBindings, getWebhooks, updateEventBindings } from "@/api"
import { toast } from "sonner"
import type { EventDefinition, EventBinding, Webhook } from "@/types"

const NONE_VALUE = "__none__"

export function EventBindingsCard() {
  const [events, setEvents] = useState<EventDefinition[]>([])
  const [bindings, setBindings] = useState<EventBinding[]>([])
  const [origBindings, setOrigBindings] = useState<EventBinding[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getEvents(), getEventBindings(), getWebhooks()])
      .then(([evts, binds, whs]) => {
        setEvents(evts || [])
        setWebhooks(whs || [])
        // 确保每个事件都有绑定记录
        const bindMap = new Map((binds || []).map(b => [b.event, b]))
        const full = (evts || []).map(e => bindMap.get(e.name) || { event: e.name, webhook_name: "", enabled: false })
        setBindings(full)
        setOrigBindings(JSON.parse(JSON.stringify(full)))
      })
      .catch(() => {})
  }, [])

  const dirty = JSON.stringify(bindings) !== JSON.stringify(origBindings)

  const updateBinding = (event: string, patch: Partial<EventBinding>) => {
    setBindings(prev => prev.map(b => b.event === event ? { ...b, ...patch } : b))
  }

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateEventBindings(bindings)
      setOrigBindings(JSON.parse(JSON.stringify(bindings)))
      toast.success("事件绑定已保存")
    } catch { toast.error("保存失败") }
    finally { setSaving(false) }
  }

  const getEventDef = (name: string) => events.find(e => e.name === name)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" /> 事件绑定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bindings.map(b => {
            const def = getEventDef(b.event)
            const isExpanded = expanded.has(b.event)
            return (
              <div key={b.event} className="border rounded-md p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <button type="button" className="shrink-0 p-0.5 hover:bg-muted rounded" onClick={() => toggleExpand(b.event)}>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{b.event}</div>
                    {def && <div className="text-xs text-muted-foreground">{def.description}</div>}
                  </div>
                  <Select value={b.webhook_name || NONE_VALUE} onValueChange={v => updateBinding(b.event, { webhook_name: v === NONE_VALUE ? "" : v })}>
                    <SelectTrigger className="h-7 text-xs w-[140px] shrink-0"><SelectValue placeholder="选择 Webhook" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>未绑定</SelectItem>
                      {webhooks.map(wh => (
                        <SelectItem key={wh.name} value={wh.name}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Switch checked={b.enabled} onCheckedChange={v => updateBinding(b.event, { enabled: v })} className="shrink-0" />
                </div>
                {isExpanded && def && def.variables.length > 0 && (
                  <div className="pl-6 flex flex-wrap gap-1.5">
                    {def.variables.map(v => (
                      <Badge key={v.key} variant="outline" className="text-xs font-mono">
                        {`{{${v.key}}}`} <span className="ml-1 font-normal text-muted-foreground">{v.description}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
