import React, { useState, useEffect } from "react"
import { Eye, EyeOff, Save, Zap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { addAIProvider, updateAIProvider, testAIProvider, fetchAIModels } from "@/api"
import type { AIProvider } from "@/types"
import { toast } from "sonner"

interface ProviderPreset {
  label: string
  name: string
  endpoint: string
  model: string
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "OpenAI", name: "OpenAI", endpoint: "https://api.openai.com/v1", model: "gpt-4o" },
  { label: "Anthropic Claude", name: "Claude", endpoint: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
  { label: "Google Gemini", name: "Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  { label: "DeepSeek", name: "DeepSeek", endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "通义千问 Qwen", name: "Qwen", endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "硅基流动 SiliconFlow", name: "SiliconFlow", endpoint: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  { label: "Groq", name: "Groq", endpoint: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { label: "OpenRouter", name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", model: "openai/gpt-4o" },
  { label: "Ollama 本地", name: "Ollama", endpoint: "http://localhost:11434/v1", model: "llama3" },
  { label: "自定义", name: "", endpoint: "", model: "" },
]

interface AIProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: AIProvider | null
  onSaved: () => void
}

// PLACEHOLDER_COMPONENT

export function AIProviderDialog({ open, onOpenChange, provider, onSaved }: AIProviderDialogProps) {
  const isNew = !provider
  const [form, setForm] = useState<AIProvider>({ name: "", endpoint: "", api_key: "", model: "", default: false })
  const [selectedPreset, setSelectedPreset] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)

  useEffect(() => {
    if (open) {
      if (provider) {
        setForm({ ...provider })
        setSelectedPreset("")
        setUseCustomModel(true)
      } else {
        setForm({ name: "", endpoint: "", api_key: "", model: "", default: false })
        setSelectedPreset("")
        setUseCustomModel(false)
      }
      setModels([])
      setShowKey(false)
    }
  }, [open, provider])

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label)
    const preset = PROVIDER_PRESETS.find((p) => p.label === label)
    if (preset) {
      setForm((prev) => ({
        ...prev,
        name: preset.name || prev.name,
        endpoint: preset.endpoint || prev.endpoint,
        model: preset.model || prev.model,
      }))
      setModels([])
      setUseCustomModel(!preset.model)
    }
  }

  const handleFetchModels = async () => {
    if (!form.endpoint) {
      toast.error("请先填写接口地址")
      return
    }
    setLoadingModels(true)
    try {
      const res = await fetchAIModels(form.endpoint, form.api_key, form.name)
      if (res.code === 200 && res.data && res.data.length > 0) {
        setModels(res.data)
        setUseCustomModel(false)
        toast.success(`获取到 ${res.data.length} 个模型`)
      } else {
        toast.error("获取模型列表失败", { description: res.message })
        setUseCustomModel(true)
      }
    } catch {
      toast.error("获取模型列表失败")
      setUseCustomModel(true)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await testAIProvider(form)
      if (res.code === 200) {
        toast.success("连接成功")
      } else {
        toast.error("连接失败", { description: res.message })
      }
    } catch {
      toast.error("测试请求失败")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.endpoint || !form.model) {
      toast.error("名称、接口地址和模型不能为空")
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await addAIProvider(form)
        toast.success("添加成功")
      } else {
        await updateAIProvider(form.name, form)
        toast.success("更新成功")
      }
      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // PLACEHOLDER_JSX

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isNew ? "添加 AI 服务提供商" : `编辑 ${form.name}`}</DialogTitle>
          <DialogDescription className="text-xs">配置 OpenAI 兼容接口信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {/* Preset selector (new only) */}
          {isNew && (
            <div className="space-y-1.5">
              <Label className="text-xs">服务商</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择服务商..." />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">名称</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如: OpenAI" disabled={!isNew} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">接口地址</Label>
            <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://api.openai.com/v1" className="text-sm font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <div className="relative">
              <Input type={showKey ? "text" : "password"} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." className="text-sm font-mono pr-9" autoComplete="off" />
              <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">模型</Label>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={handleFetchModels} disabled={loadingModels || !form.endpoint}>
                {loadingModels ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {loadingModels ? "获取中..." : "获取模型列表"}
              </Button>
            </div>
            {models.length > 0 && !useCustomModel ? (
              <Select value={form.model} onValueChange={(v) => {
                if (v === "__custom__") {
                  setUseCustomModel(true)
                  setForm({ ...form, model: "" })
                } else {
                  setForm({ ...form, model: v })
                }
              }}>
                <SelectTrigger className="w-full font-mono text-sm">
                  <SelectValue placeholder="选择模型..." />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                  ))}
                  <SelectItem value="__custom__" className="text-xs text-muted-foreground">手动输入...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-1.5">
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o" className="text-sm font-mono flex-1" />
                {models.length > 0 && (
                  <Button variant="outline" size="sm" className="shrink-0 text-xs h-9" onClick={() => setUseCustomModel(false)}>列表</Button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="h-3.5 w-3.5 mr-1" />{saving ? "保存中..." : "保存"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              <Zap className="h-3.5 w-3.5 mr-1" />{testing ? "测试中..." : "测试连接"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
