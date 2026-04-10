import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Webhook as WebhookIcon, Plus, Pencil, Trash2, Play, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getWebhooks, deleteWebhook, testWebhook, getEvents, getEventBindings } from "@/api"
import { toast } from "sonner"
import { WebhookDialog } from "./WebhookDialog"
import type { Webhook, EventDefinition, EventBinding } from "@/types"

export function WebhookSettingsCard() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [events, setEvents] = useState<EventDefinition[]>([])
  const [bindings, setBindings] = useState<EventBinding[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Webhook | null>(null)
  const [copyFrom, setCopyFrom] = useState<Webhook | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () => {
    Promise.all([getWebhooks(), getEventBindings()])
      .then(([whs, binds]) => {
        setWebhooks(whs || [])
        setBindings(binds || [])
      })
      .catch(() => {})
  }
  useEffect(() => {
    load()
    getEvents().then(setEvents).catch(() => {})
  }, [])

  // 查找绑定到某个 webhook 的事件列表
  const getBoundEvents = (webhookName: string) =>
    bindings.filter(b => b.webhook_name === webhookName).map(b => b.event)

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteWebhook(deleting)
      toast.success("已删除")
      load()
    } catch { toast.error("删除失败") }
    finally { setDeleting(null) }
  }

  const handleTest = async (name: string) => {
    setTesting(name)
    try {
      const res = await testWebhook(name)
      if (res.code === 200) toast.success("测试成功")
      else toast.error(res.message)
    } catch { toast.error("测试失败") }
    finally { setTesting(null) }
  }

  const deleteBoundEvents = deleting ? getBoundEvents(deleting) : []

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <WebhookIcon className="h-4 w-4" /> Webhook 管理
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(null); setCopyFrom(null); setDialogOpen(true) }}>
              <Plus className="h-3 w-3 mr-1" />新建
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">暂无 Webhook 配置</div>
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => {
                const boundEvents = getBoundEvents(wh.name)
                return (
                  <div key={wh.name} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2 rounded-md border text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Badge variant="secondary" className="text-xs shrink-0">{wh.method}</Badge>
                      <span className="font-medium shrink-0">{wh.name}</span>
                      <span className="text-muted-foreground truncate text-xs max-w-[200px] sm:max-w-none">{wh.url}</span>
                      {boundEvents.length > 0 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{boundEvents.length} 个绑定</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto sm:ml-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleTest(wh.name)} disabled={testing === wh.name} title="测试">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(null); setCopyFrom(wh); setDialogOpen(true) }} title="复制">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(wh); setCopyFrom(null); setDialogOpen(true) }} title="编辑">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleting(wh.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <WebhookDialog open={dialogOpen} onOpenChange={setDialogOpen} webhook={editing} copyFrom={copyFrom} onSaved={load} events={events} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>确定要删除 Webhook「{deleting}」吗？</p>
                {deleteBoundEvents.length > 0 && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-1">
                    <p className="text-amber-700 dark:text-amber-400 font-medium text-sm">
                      该 Webhook 已绑定 {deleteBoundEvents.length} 个事件：
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {deleteBoundEvents.map(e => (
                        <Badge key={e} variant="outline" className="text-xs font-mono border-amber-500 text-amber-600">{e}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      删除后这些事件绑定将失效，建议先移除相关绑定
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
