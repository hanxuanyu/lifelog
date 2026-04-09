import { useState, useEffect, lazy, Suspense } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Play, Copy, ClipboardPaste, Braces } from "lucide-react"
import { createWebhook, updateWebhook, testWebhookDry, getEventBindings, updateEventBindings } from "@/api"
import { toast } from "sonner"
import type { Webhook, EventDefinition } from "@/types"

const CodeMirror = lazy(() => import("@uiw/react-codemirror"))
const jsonLangImport = () => import("@codemirror/lang-json").then(m => m.json())

const NONE_VALUE = "__none__"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook?: Webhook | null
  copyFrom?: Webhook | null
  onSaved: () => void
  events?: EventDefinition[]
}

const emptyWebhook: Webhook = {
  name: "", url: "", method: "POST", headers: {}, query_params: {}, body: "", timeout_seconds: 10,
}

export function WebhookDialog({ open, onOpenChange, webhook, copyFrom, onSaved, events }: Props) {
  const isEdit = !!webhook
  const [form, setForm] = useState<Webhook>(emptyWebhook)
  const [headers, setHeaders] = useState<[string, string][]>([])
  const [queryParams, setQueryParams] = useState<[string, string][]>([])
  const [saving, setSaving] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState("")
  const [autoBind, setAutoBind] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    code: number; message: string
    data?: { status_code: number; body: string }
  } | null>(null)
  const [jsonExt, setJsonExt] = useState<import("@codemirror/language").LanguageSupport[] | null>(null)

  useEffect(() => {
    jsonLangImport().then(ext => setJsonExt([ext] as never))
  }, [])

  useEffect(() => {
    if (open) {
      if (webhook) {
        setForm(webhook)
        setHeaders(Object.entries(webhook.headers || {}))
        setQueryParams(Object.entries(webhook.query_params || {}))
      } else if (copyFrom) {
        setForm({ ...copyFrom, name: "" })
        setHeaders(Object.entries(copyFrom.headers || {}))
        setQueryParams(Object.entries(copyFrom.query_params || {}))
      } else {
        setForm(emptyWebhook)
        setHeaders([])
        setQueryParams([])
      }
      setSelectedEvent("")
      setAutoBind(false)
      setTestResult(null)
    }
  }, [open, webhook, copyFrom])

  const selectedEventDef = events?.find(e => e.name === selectedEvent)

  const copyVariable = (key: string) => {
    const tag = `{{${key}}}`
    navigator.clipboard.writeText(tag)
    toast.success(`已复制 ${tag}`)
  }

  const buildPayload = (): Webhook => ({
    ...form,
    name: form.name.trim(),
    url: form.url.trim(),
    headers: Object.fromEntries(headers.filter(([k]) => k.trim())),
    query_params: Object.fromEntries(queryParams.filter(([k]) => k.trim())),
  })

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("名称和 URL 为必填项")
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        await updateWebhook(webhook!.name, payload)
        toast.success("Webhook 已更新")
      } else {
        await createWebhook(payload)
        toast.success("Webhook 已创建")
        // 自动绑定事件
        if (autoBind && selectedEvent) {
          try {
            const bindings = await getEventBindings() || []
            bindings.push({ event: selectedEvent, webhook_name: payload.name, enabled: true })
            await updateEventBindings(bindings)
            toast.success(`已自动绑定到 ${selectedEvent}`)
          } catch {
            toast.error("自动绑定失败，请手动绑定")
          }
        }
      }
      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!form.url.trim()) {
      toast.error("URL 为必填项")
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const payload = buildPayload()
      const res = await testWebhookDry(payload, selectedEvent || undefined)
      setTestResult(res as typeof testResult)
      if (res.code === 200) toast.success("测试成功")
      else toast.error(res.message)
    } catch { toast.error("测试请求失败") }
    finally { setTesting(false) }
  }
  // PLACEHOLDER_KV_RENDER

  const addKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>) => {
    setter(prev => [...prev, ["", ""]])
  }
  const removeKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>, idx: number) => {
    setter(prev => prev.filter((_, i) => i !== idx))
  }
  const updateKV = (setter: React.Dispatch<React.SetStateAction<[string, string][]>>, idx: number, pos: 0 | 1, val: string) => {
    setter(prev => prev.map((pair, i) => i === idx ? (pos === 0 ? [val, pair[1]] : [pair[0], val]) as [string, string] : pair))
  }

  const pasteToKV = async (setter: React.Dispatch<React.SetStateAction<[string, string][]>>, idx: number) => {
    try {
      const text = await navigator.clipboard.readText()
      setter(prev => prev.map((pair, i) => i === idx ? [pair[0], pair[1] + text] as [string, string] : pair))
    } catch { toast.error("无法读取剪贴板") }
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
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 shrink-0" onClick={() => pasteToKV(setter, i)} title="粘贴">
            <ClipboardPaste className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 shrink-0" onClick={() => removeKV(setter, i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="shrink-0 p-6 pb-3">
          <DialogTitle>{isEdit ? "编辑 Webhook" : copyFrom ? "复制 Webhook" : "新建 Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 space-y-3">
          {/* 事件选择 */}
          {events && events.length > 0 && (
            <div className="space-y-1.5 border rounded-md p-2.5 bg-muted/30">
              <Label className="text-xs">关联事件（可选，用于变量提示和测试数据）</Label>
              <Select value={selectedEvent || NONE_VALUE} onValueChange={v => setSelectedEvent(v === NONE_VALUE ? "" : v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择事件" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>不选择</SelectItem>
                  {events.map(e => (
                    <SelectItem key={e.name} value={e.name}>{e.name} - {e.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 变量列表 */}
              {selectedEventDef && selectedEventDef.variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEventDef.variables.map(v => (
                    <Badge key={v.key} variant="outline"
                      className="text-xs font-mono cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => copyVariable(v.key)}>
                      <Copy className="h-3 w-3 mr-1" />
                      {`{{${v.key}}}`} <span className="ml-1 font-normal text-muted-foreground">{v.description}</span>
                    </Badge>
                  ))}
                </div>
              )}
              {selectedEventDef && (
                <p className="text-xs text-muted-foreground">点击变量复制到剪贴板</p>
              )}
              {/* 自动绑定开关 */}
              {selectedEvent && !isEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={autoBind} onCheckedChange={setAutoBind} />
                  <span className="text-xs text-muted-foreground">创建后自动绑定到此事件</span>
                </div>
              )}
            </div>
          )}
          {/* 基本信息 */}
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Body</Label>
              <div className="flex items-center gap-0.5">
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" title="粘贴" onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText()
                    setForm(f => ({ ...f, body: f.body + text }))
                  } catch { toast.error("无法读取剪贴板") }
                }}>
                  <ClipboardPaste className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" title="格式化 JSON" onClick={() => {
                  try {
                    const formatted = JSON.stringify(JSON.parse(form.body), null, 2)
                    setForm(f => ({ ...f, body: formatted }))
                  } catch {
                    toast.error("JSON 格式错误，无法格式化")
                  }
                }}>
                  <Braces className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="border rounded-md overflow-hidden">
              <Suspense fallback={<div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">加载编辑器...</div>}>
                <CodeMirror
                  value={form.body}
                  height="200px"
                  extensions={jsonExt || []}
                  onChange={v => setForm(f => ({ ...f, body: v }))}
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    autocompletion: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    indentOnInput: true,
                  }}
                  placeholder={'{"text": "{{event_type}}: {{detail}}"}'}
                />
              </Suspense>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            支持占位符 {"{{变量名}}"}，在事件触发时自动替换为对应值
          </p>
        </div>
        <div className="shrink-0 px-6 pb-6 pt-3 space-y-2 border-t">
          {testResult?.data && (
            <div className="border rounded-md p-2 text-xs space-y-1 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">状态码:</span>
                <Badge variant={testResult.data.status_code < 400 ? "secondary" : "destructive"} className="text-xs">
                  {testResult.data.status_code}
                </Badge>
              </div>
              {testResult.data.body && (
                <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">{testResult.data.body}</pre>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleTest} disabled={testing}>
              <Play className="h-3 w-3 mr-1" />{testing ? "测试中..." : "测试调用"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}