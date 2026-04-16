import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Pencil, Bot, Zap, Star, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { getAIProviders, updateAIProvider, deleteAIProvider, testAIProvider, getPrompts, createPrompt, updatePrompt, deletePrompt } from "@/api"
import type { AIProvider, Prompt } from "@/types"
import { toast } from "sonner"
import { AIProviderDialog } from "./AIProviderDialog"

export function AIProviderSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [testingIdx, setTestingIdx] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<AIProvider | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Prompts state
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [promptForm, setPromptForm] = useState({ name: "", description: "", content: "" })
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [deletingPrompt, setDeletingPrompt] = useState<string | null>(null)

  const loadPrompts = useCallback(() => {
    getPrompts().then((data) => setPrompts(data || [])).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    getAIProviders()
      .then((data) => setProviders(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); loadPrompts() }, [loadPrompts])

  const handleTest = async (idx: number) => {
    const p = providers[idx]
    setTestingIdx(idx)
    try {
      const res = await testAIProvider(p)
      if (res.code === 200) {
        toast.success("连接成功", { description: `${p.name} (${p.model})` })
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
      toast.success("已删除")
      load()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleting(null)
    }
  }

  const handleSetDefault = async (idx: number) => {
    const p = providers[idx]
    try {
      await updateAIProvider(p.name, { ...p, default: true })
      toast.success(`已设为默认: ${p.name}`)
      load()
    } catch {
      toast.error("设置失败")
    }
  }

  const openCreatePrompt = () => {
    setEditingPrompt(null)
    setPromptForm({ name: "", description: "", content: "" })
    setPromptDialogOpen(true)
  }

  const openEditPrompt = (p: Prompt) => {
    setEditingPrompt(p)
    setPromptForm({ name: p.name, description: p.description, content: p.content })
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
        await updatePrompt(editingPrompt.name, { name: promptForm.name.trim(), description: promptForm.description.trim(), content: promptForm.content.trim() })
        toast.success("提示词已更新")
      } else {
        await createPrompt({ name: promptForm.name.trim(), description: promptForm.description.trim(), content: promptForm.content.trim() })
        toast.success("提示词已创建")
      }
      setPromptDialogOpen(false)
      loadPrompts()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error(msg)
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleDeletePrompt = async () => {
    if (!deletingPrompt) return
    try {
      await deletePrompt(deletingPrompt)
      toast.success("已删除")
      loadPrompts()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeletingPrompt(null)
    }
  }

  const builtinPrompts = prompts.filter((p) => p.builtin)
  const customPrompts = prompts.filter((p) => !p.builtin)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" /> AI 服务配置
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                配置 AI 服务提供商（支持 OpenAI 兼容接口）
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditProvider(null); setDialogOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> 添加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {providers.map((p, idx) => (
                <motion.div
                  key={p.name}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        {p.default && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{p.model}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!p.default && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSetDefault(idx)} title="设为默认">
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleTest(idx)} disabled={testingIdx !== null} title="测试连接">
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditProvider(p); setDialogOpen(true) }} title="编辑">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(p.name)} title="删除">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {providers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂未配置 AI 服务，点击上方按钮添加
              </p>
            )}
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> 提示词管理
              </div>
              <Button size="sm" variant="outline" onClick={openCreatePrompt}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 添加
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">管理 AI 对话和定时报告任务使用的提示词模板。</p>

            {builtinPrompts.map((p) => (
              <div key={p.name} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">内置</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                </div>
              </div>
            ))}

            <AnimatePresence mode="popLayout">
              {customPrompts.map((p) => (
                <motion.div key={p.name} layout="position" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{p.name}</span>
                      <p className="text-xs text-muted-foreground truncate">{p.description || p.content.slice(0, 60)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPrompt(p)} title="编辑">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingPrompt(p.name)} title="删除">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {customPrompts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">暂无自定义提示词</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AIProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editProvider}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 AI 服务商「{deleting}」吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={promptDialogOpen} onOpenChange={(open) => { setPromptDialogOpen(open); if (!open) { setEditingPrompt(null); setPromptForm({ name: "", description: "", content: "" }) } }}>
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
                onChange={(e) => setPromptForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：周报重点分析"
                className="h-9 text-sm"
                disabled={!!editingPrompt}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">描述</label>
              <Input
                value={promptForm.description}
                onChange={(e) => setPromptForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="简短描述，显示为按钮文字"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">内容</label>
              <Textarea
                value={promptForm.content}
                onChange={(e) => setPromptForm((f) => ({ ...f, content: e.target.value }))}
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
              确定要删除提示词「{deletingPrompt}」吗？引用该提示词的定时任务将自动回退到默认提示词。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePrompt} className="bg-destructive text-white hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
