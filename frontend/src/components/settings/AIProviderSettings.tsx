import React, { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Pencil, Bot, Zap, Star, FileText, Loader2, RefreshCw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  deleteAIProvider,
  testAIProvider,
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getAIProviders,
  updateAIProvider,
  getSettings,
  updateSettings,
  fetchAIModels,
} from "@/api"
import type { AIProvider, Prompt } from "@/types"
import { toast } from "sonner"
import { AIProviderDialog } from "./AIProviderDialog"

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

export function AIProviderSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [testingIdx, setTestingIdx] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<AIProvider | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [defaultModel, setDefaultModel] = useState("")
  const [defaultModelDraft, setDefaultModelDraft] = useState("")
  const [defaultModels, setDefaultModels] = useState<string[]>([])
  const [loadingDefaultModels, setLoadingDefaultModels] = useState(false)
  const [savingDefaultModel, setSavingDefaultModel] = useState(false)
  const [useCustomDefaultModel, setUseCustomDefaultModel] = useState(true)

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [promptForm, setPromptForm] = useState({ name: "", description: "", content: "" })
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [deletingPrompt, setDeletingPrompt] = useState<string | null>(null)

  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.default) || providers[0] || null,
    [providers],
  )
  const resolvedDefaultModels = useMemo(
    () => uniqueStrings([defaultModelDraft, defaultProvider?.model || "", ...defaultModels]),
    [defaultModelDraft, defaultModels, defaultProvider],
  )
  const defaultModelDirty = defaultModelDraft.trim() !== defaultModel.trim()
  const builtinPrompts = prompts.filter((prompt) => prompt.builtin)
  const customPrompts = prompts.filter((prompt) => !prompt.builtin)

  const loadProviders = useCallback(async () => {
    const data = await getAIProviders()
    setProviders(data || [])
  }, [])

  const loadPrompts = useCallback(async () => {
    const data = await getPrompts()
    setPrompts(data || [])
  }, [])

  const loadDefaultModel = useCallback(async () => {
    const settings = await getSettings()
    const nextDefaultModel = settings?.ai?.default_model || ""
    setDefaultModel(nextDefaultModel)
    setDefaultModelDraft(nextDefaultModel)
  }, [])

  const loadDefaultModelOptions = useCallback(async (provider: AIProvider, preferredModel?: string) => {
    setLoadingDefaultModels(true)
    try {
      const response = await fetchAIModels(provider.endpoint, provider.api_key, provider.name)
      if (response.code !== 200 || !response.data || response.data.length === 0) {
        throw new Error(response.message || "未获取到模型列表")
      }
      const merged = uniqueStrings([preferredModel || "", defaultModelDraft, provider.model, ...response.data])
      setDefaultModels(merged)
      const targetModel = preferredModel || defaultModelDraft
      setUseCustomDefaultModel(!targetModel || !merged.includes(targetModel))
      toast.success("默认供应商模型列表已刷新", { description: `${provider.name} · ${response.data.length} 个模型` })
    } catch (error) {
      setUseCustomDefaultModel(true)
      const message = error instanceof Error ? error.message : "获取模型列表失败"
      toast.error("获取模型列表失败", { description: message })
    } finally {
      setLoadingDefaultModels(false)
    }
  }, [defaultModelDraft])

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadProviders(), loadPrompts(), loadDefaultModel()])
    } catch {
      toast.error("加载 AI 配置失败")
    }
  }, [loadDefaultModel, loadPrompts, loadProviders])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!defaultProvider) {
      setDefaultModels([])
      setUseCustomDefaultModel(true)
    }
  }, [defaultProvider])

  const handleTest = async (idx: number) => {
    const provider = providers[idx]
    setTestingIdx(idx)
    try {
      const res = await testAIProvider(provider)
      if (res.code === 200) {
        toast.success("连接成功", { description: `${provider.name} (${provider.model})` })
      } else {
        toast.error("连接失败", { description: res.message })
      }
    } catch {
      toast.error("测试请求失败")
    } finally {
      setTestingIdx(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteAIProvider(deleting)
      toast.success("提供商已删除")
      await loadAll()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleting(null)
    }
  }

  const handleSetDefault = async (idx: number) => {
    const provider = providers[idx]
    try {
      await updateAIProvider(provider.name, { ...provider, default: true })
      await updateSettings({ ai_default_model: provider.model })
      setDefaultModel(provider.model)
      setDefaultModelDraft(provider.model)
      setDefaultModels(uniqueStrings([provider.model]))
      setUseCustomDefaultModel(false)
      toast.success(`已将 ${provider.name} 设为默认供应商`, { description: `默认模型已同步为 ${provider.model}` })
      await loadProviders()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "设置失败"
      toast.error("设置失败", { description: message })
    }
  }

  const handleSaveDefaultModel = async () => {
    const nextModel = defaultModelDraft.trim()
    if (!defaultProvider) {
      toast.error("请先配置默认供应商")
      return
    }
    if (!nextModel) {
      toast.error("默认模型不能为空")
      return
    }

    setSavingDefaultModel(true)
    try {
      await updateSettings({ ai_default_model: nextModel })
      setDefaultModel(nextModel)
      setDefaultModelDraft(nextModel)
      setDefaultModels((prev) => uniqueStrings([nextModel, ...prev]))
      toast.success("默认模型已保存", { description: `${defaultProvider.name} · ${nextModel}` })
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: message })
    } finally {
      setSavingDefaultModel(false)
    }
  }

  const openCreatePrompt = () => {
    setEditingPrompt(null)
    setPromptForm({ name: "", description: "", content: "" })
    setPromptDialogOpen(true)
  }

  const openEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setPromptForm({ name: prompt.name, description: prompt.description, content: prompt.content })
    setPromptDialogOpen(true)
  }

  const handleSavePrompt = async () => {
    if (!promptForm.name.trim() || !promptForm.content.trim()) {
      toast.error("名称和内容不能为空")
      return
    }

    setSavingPrompt(true)
    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.name, {
          name: promptForm.name.trim(),
          description: promptForm.description.trim(),
          content: promptForm.content.trim(),
        })
        toast.success("提示词已更新")
      } else {
        await createPrompt({
          name: promptForm.name.trim(),
          description: promptForm.description.trim(),
          content: promptForm.content.trim(),
        })
        toast.success("提示词已创建")
      }
      setPromptDialogOpen(false)
      await loadPrompts()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error(message)
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleDeletePrompt = async () => {
    if (!deletingPrompt) return
    try {
      await deletePrompt(deletingPrompt)
      toast.success("提示词已删除")
      await loadPrompts()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeletingPrompt(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4" /> AI 服务配置
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                配置 AI 提供商，并设置定时任务默认使用的供应商与模型。
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditProvider(null); setDialogOpen(true) }}>
              <Plus className="mr-1 h-3.5 w-3.5" /> 添加
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {providers.map((provider, idx) => (
                <motion.div
                  key={provider.name}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{provider.name}</span>
                        {provider.default && <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">{provider.model}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!provider.default && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="设为默认供应商" onClick={() => handleSetDefault(idx)}>
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="测试连接"
                        onClick={() => handleTest(idx)}
                        disabled={testingIdx !== null}
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="编辑" onClick={() => { setEditProvider(provider); setDialogOpen(true) }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => setDeleting(provider.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {providers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                还没有配置 AI 提供商，点击上方按钮开始添加。
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">默认模型</div>
                <p className="text-xs text-muted-foreground">
                  定时报告任务和未显式指定模型的 AI 能力会优先使用这里的模型。
                </p>
              </div>
              {defaultProvider && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {defaultProvider.name}
                </Badge>
              )}
            </div>

            {!defaultProvider ? (
              <div className="text-xs text-muted-foreground">请先配置并选择默认供应商。</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>当前默认供应商模型</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {defaultProvider.model}
                  </Badge>
                  {defaultModel && defaultModel !== defaultProvider.model && (
                    <>
                      <span>任务默认模型</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {defaultModel}
                      </Badge>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">模型选择</label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => void loadDefaultModelOptions(defaultProvider, defaultModelDraft || defaultProvider.model)}
                        disabled={loadingDefaultModels}
                      >
                        {loadingDefaultModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        拉取模型
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setDefaultModelDraft(defaultProvider.model)
                          setUseCustomDefaultModel(false)
                          setDefaultModels((prev) => uniqueStrings([defaultProvider.model, ...prev]))
                        }}
                      >
                        使用供应商默认值
                      </Button>
                    </div>
                  </div>

                  {resolvedDefaultModels.length > 0 && !useCustomDefaultModel ? (
                    <Select
                      value={defaultModelDraft || defaultProvider.model}
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setUseCustomDefaultModel(true)
                          return
                        }
                        setDefaultModelDraft(value)
                      }}
                    >
                      <SelectTrigger className="w-full font-mono text-sm">
                        <SelectValue placeholder="选择默认模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolvedDefaultModels.map((modelName) => (
                          <SelectItem key={modelName} value={modelName} className="font-mono text-xs">
                            {modelName}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="text-xs text-muted-foreground">
                          手动输入...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={defaultModelDraft}
                        onChange={(event) => setDefaultModelDraft(event.target.value)}
                        placeholder={defaultProvider.model}
                        className="font-mono text-sm"
                      />
                      {resolvedDefaultModels.length > 0 && (
                        <Button size="sm" variant="outline" className="h-9" onClick={() => setUseCustomDefaultModel(false)}>
                          列表
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDefaultModelDraft(defaultModel)
                      setUseCustomDefaultModel(resolvedDefaultModels.length === 0 || !resolvedDefaultModels.includes(defaultModel))
                    }}
                    disabled={!defaultModelDirty}
                  >
                    重置
                  </Button>
                  <Button size="sm" onClick={handleSaveDefaultModel} disabled={!defaultModelDirty || savingDefaultModel}>
                    {savingDefaultModel ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                    保存默认模型
                  </Button>
                </div>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> 提示词管理
              </div>
              <Button size="sm" variant="outline" onClick={openCreatePrompt}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 添加
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">管理 AI 对话和定时任务使用的提示词模板。</p>

            {builtinPrompts.map((prompt) => (
              <div key={prompt.name} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{prompt.name}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">内置</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{prompt.description}</p>
                </div>
              </div>
            ))}

            <AnimatePresence mode="popLayout">
              {customPrompts.map((prompt) => (
                <motion.div key={prompt.name} layout="position" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <div className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{prompt.name}</span>
                      <p className="truncate text-xs text-muted-foreground">{prompt.description || prompt.content.slice(0, 60)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="编辑" onClick={() => openEditPrompt(prompt)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => setDeletingPrompt(prompt.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {customPrompts.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">暂无自定义提示词</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AIProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} provider={editProvider} onSaved={() => void loadAll()} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 AI 服务商“{deleting}”吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={promptDialogOpen}
        onOpenChange={(open) => {
          setPromptDialogOpen(open)
          if (!open) {
            setEditingPrompt(null)
            setPromptForm({ name: "", description: "", content: "" })
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? "编辑提示词" : "添加自定义提示词"}</DialogTitle>
            <DialogDescription>提示词可在 AI 对话和定时报告任务中使用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">名称</label>
              <Input
                value={promptForm.name}
                onChange={(event) => setPromptForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="如：周报重点分析"
                className="h-9 text-sm"
                disabled={!!editingPrompt}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">描述</label>
              <Input
                value={promptForm.description}
                onChange={(event) => setPromptForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="简短说明，展示在选择列表里"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">内容</label>
              <Textarea
                value={promptForm.content}
                onChange={(event) => setPromptForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="输入提示词内容..."
                rows={6}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>取消</Button>
            <Button onClick={handleSavePrompt} disabled={savingPrompt}>
              {savingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPrompt ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPrompt} onOpenChange={(open) => { if (!open) setDeletingPrompt(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除提示词“{deletingPrompt}”吗？引用它的定时任务会自动回退到默认提示词。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePrompt} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
