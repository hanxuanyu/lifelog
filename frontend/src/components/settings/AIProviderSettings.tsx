import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Pencil, Bot, Zap, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getAIProviders, updateAIProvider, deleteAIProvider, testAIProvider } from "@/api"
import type { AIProvider } from "@/types"
import { toast } from "sonner"
import { AIProviderDialog } from "./AIProviderDialog"

export function AIProviderSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [testingIdx, setTestingIdx] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<AIProvider | null>(null)

  const load = () => {
    setLoading(true)
    getAIProviders()
      .then((data) => setProviders(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  const handleDelete = async (name: string) => {
    try {
      await deleteAIProvider(name)
      toast.success("已删除")
      load()
    } catch {
      toast.error("删除失败")
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
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p.name)} title="删除">
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
        </CardContent>
      </Card>

      <AIProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editProvider}
        onSaved={load}
      />
    </motion.div>
  )
}
