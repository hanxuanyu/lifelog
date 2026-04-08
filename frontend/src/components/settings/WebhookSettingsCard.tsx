import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Webhook as WebhookIcon, Plus, Pencil, Trash2, Play } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getWebhooks, deleteWebhook, testWebhook } from "@/api"
import { toast } from "sonner"
import { WebhookDialog } from "./WebhookDialog"
import type { Webhook } from "@/types"

export function WebhookSettingsCard() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Webhook | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const load = () => { getWebhooks().then(setWebhooks).catch(() => {}) }
  useEffect(load, [])

  const handleDelete = async (name: string) => {
    try {
      await deleteWebhook(name)
      toast.success("已删除")
      load()
    } catch { toast.error("删除失败") }
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <WebhookIcon className="h-4 w-4" /> Webhook 管理
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(null); setDialogOpen(true) }}>
              <Plus className="h-3 w-3 mr-1" />新建
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">暂无 Webhook 配置</div>
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.name} className="flex items-center justify-between p-2 rounded-md border text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-xs shrink-0">{wh.method}</Badge>
                    <span className="font-medium shrink-0">{wh.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{wh.url}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleTest(wh.name)} disabled={testing === wh.name}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(wh); setDialogOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(wh.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <WebhookDialog open={dialogOpen} onOpenChange={setDialogOpen} webhook={editing} onSaved={load} />
    </motion.div>
  )
}