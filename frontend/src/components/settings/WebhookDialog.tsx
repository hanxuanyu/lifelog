import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { createWebhook, updateWebhook } from "@/api"
import { toast } from "sonner"
import type { Webhook } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook?: Webhook | null
  onSaved: () => void
}

const emptyWebhook: Webhook = {
  name: "", url: "", method: "POST", headers: {}, query_params: {}, body: "", timeout_seconds: 10,
}

export function WebhookDialog({ open, onOpenChange, webhook, onSaved }: Props) {
  const isEdit = !!webhook
  const [form, setForm] = useState<Webhook>(emptyWebhook)
  const [headers, setHeaders] = useState<[string, string][]>([])
  const [queryParams, setQueryParams] = useState<[string, string][]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (webhook) {
        setForm(webhook)
        setHeaders(Object.entries(webhook.headers || {}))
        setQueryParams(Object.entries(webhook.query_params || {}))
      } else {
        setForm(emptyWebhook)
        setHeaders([])
        setQueryParams([])
      }
    }
  }, [open, webhook])

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("名称和 URL 为必填项")
      return
    }
    setSaving(true)
    try {
      const payload: Webhook = {
        ...form,
        name: form.name.trim(),
        url: form.url.trim(),
        headers: Object.fromEntries(headers.filter(([k]) => k.trim())),
        query_params: Object.fromEntries(queryParams.filter(([k]) => k.trim())),
      }
      if (isEdit) {
        await updateWebhook(webhook!.name, payload)
        toast.success("Webhook 已更新")
      } else {
        await createWebhook(payload)
        toast.success("Webhook 已创建")
      }
      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const addKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>) => {
    setter(prev => [...prev, ["", ""]])
  }
  const removeKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>, idx: number) => {
    setter(prev => prev.filter((_, i) => i !== idx))
  }
  const updateKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>, idx: number, pos: 0 | 1, val: string) => {
    setter(prev => prev.map((pair, i) => i === idx ? (pos === 0 ? [val, pair[1]] : [pair[0], val]) as [string, string] : pair))
  }

  const renderKVEditor = (
    label: string,
    items: [string, string][],
    setter: React.Dispatch<React.SetStateAction<[string, string][]>>,
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => addKV(setter)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {items.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <Input className="h-7 text-xs" placeholder="Key" value={k} onChange={e => updateKV(setter, i, 0, e.target.value)} />
          <Input className="h-7 text-xs" placeholder="Value" value={v} onChange={e => updateKV(setter, i, 1, e.target.value)} />
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 shrink-0" onClick={() => removeKV(setter, i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑 Webhook" : "新建 Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">名称</Label>
            <Input className="h-8 text-sm" value={form.name} disabled={isEdit}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-webhook" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">请求方法</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "DELETE", "PATCH"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">超时(秒)</Label>
              <Input className="h-8 text-sm" type="number" min={1} value={form.timeout_seconds}
                onChange={e => setForm(f => ({ ...f, timeout_seconds: parseInt(e.target.value) || 10 }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input className="h-8 text-sm" value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhook/{{event_type}}" />
          </div>
          {renderKVEditor("Headers", headers, setHeaders)}
          {renderKVEditor("Query Params", queryParams, setQueryParams)}
          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <Textarea className="text-xs min-h-[80px] font-mono" value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={'{"text": "{{event_type}}: {{detail}}"}'} />
          </div>
          <p className="text-xs text-muted-foreground">
            支持占位符 {"{{变量名}}"}，在事件触发时自动替换为对应值
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
