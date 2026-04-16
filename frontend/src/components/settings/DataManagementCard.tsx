import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { Database, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { exportData, importData } from "@/api"
import type { ImportConfigType } from "@/types"
import { toast } from "sonner"

interface DataManagementCardProps {
  onImportComplete: () => void
}

export function DataManagementCard({ onImportComplete }: DataManagementCardProps) {
  const [importConfig, setImportConfig] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [mergeLogs, setMergeLogs] = useState(true)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [configTypes, setConfigTypes] = useState<Record<ImportConfigType, boolean>>({
    basic: true,
    auth: true,
    ai: true,
    categories: true,
    webhooks: true,
    scheduled_tasks: true,
    prompts: true,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedConfigTypes = (Object.entries(configTypes) as [ImportConfigType, boolean][])
    .filter(([, checked]) => importConfig && checked)
    .map(([type]) => type)

  const toggleConfigType = (type: ImportConfigType, checked: boolean) => {
    setConfigTypes((prev) => ({ ...prev, [type]: checked }))
  }

  const configTypeLabels: Record<ImportConfigType, string> = {
    basic: "基础配置",
    auth: "认证配置",
    ai: "AI 配置",
    categories: "分类规则",
    webhooks: "Webhook 与事件绑定",
    scheduled_tasks: "定时任务",
    prompts: "提示词配置",
  }

  const handleExport = async () => {
    setExporting(true)
    try { await exportData(); toast.success("数据导出成功") }
    catch { toast.error("导出失败") }
    finally { setExporting(false) }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".zip")) { toast.error("请选择 zip 格式的文件"); return }
    setSelectedFile(file)
    setImportDialogOpen(true)
    e.target.value = ""
  }

  const handleImportConfirm = async () => {
    if (!selectedFile) return
    setImporting(true)
    setImportDialogOpen(false)
    try {
      const res = await importData(selectedFile, mergeLogs, selectedConfigTypes)
      const d = res.data
      const parts: string[] = []
      if (d?.logs_total != null) {
        parts.push(`共 ${d.logs_total} 条日志`)
        parts.push(`导入 ${d.logs_imported ?? 0} 条`)
        if (d.logs_skipped) parts.push(`跳过 ${d.logs_skipped} 条`)
      }
      if (d?.config_imported_types?.length) {
        parts.push(`已导入配置：${d.config_imported_types.map((type) => configTypeLabels[type]).join("、")}`)
      } else if (d?.config_imported) {
        parts.push("配置已导入")
      }
      if (d?.config_need_restart) parts.push("部分配置需要重启服务后生效")
      if (d?.config_errors?.length) parts.push(`配置错误: ${d.config_errors.join("；")}`)
      else if (d?.config_error) parts.push(`配置错误: ${d.config_error}`)
      toast.success("导入完成", { description: parts.join("，") })
      onImportComplete()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "导入失败"
      toast.error("导入失败", { description: msg })
    } finally { setImporting(false); setSelectedFile(null) }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> 数据管理</CardTitle>
            <CardDescription className="text-xs">导出或导入全量日志数据与配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" className="w-full" onClick={handleExport} disabled={exporting}>
              <Download className="h-3.5 w-3.5 mr-1.5" />{exporting ? "导出中..." : "导出数据"}
            </Button>
            <div className="relative">
              <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />{importing ? "导入中..." : "导入数据"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">导出包含全部日志记录，以及基础配置、认证配置、AI 配置、分类规则、Webhook 配置、定时任务和提示词的 zip 压缩包</p>
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setSelectedFile(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导入数据</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>即将导入文件：<span className="font-medium text-foreground">{selectedFile?.name}</span></p>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">保留现有数据</p>
                      <p className="text-xs text-muted-foreground">开启后将合并导入，自动跳过重复记录；关闭则清空现有数据后导入</p>
                    </div>
                    <Switch checked={mergeLogs} onCheckedChange={setMergeLogs} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">导入配置</p>
                      <p className="text-xs text-muted-foreground">开启后可按类型覆盖当前配置</p>
                    </div>
                    <Switch checked={importConfig} onCheckedChange={setImportConfig} />
                  </div>
                  {importConfig && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">基础配置</p>
                          <p className="text-xs text-muted-foreground">时间模式、服务端口、数据库路径、MCP 配置</p>
                        </div>
                        <Switch checked={configTypes.basic} onCheckedChange={(checked) => toggleConfigType("basic", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">认证配置</p>
                          <p className="text-xs text-muted-foreground">JWT 密钥、过期时间、登录密码哈希</p>
                        </div>
                        <Switch checked={configTypes.auth} onCheckedChange={(checked) => toggleConfigType("auth", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">AI 配置</p>
                          <p className="text-xs text-muted-foreground">AI 服务提供商列表与默认模型设置</p>
                        </div>
                        <Switch checked={configTypes.ai} onCheckedChange={(checked) => toggleConfigType("ai", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">分类规则</p>
                          <p className="text-xs text-muted-foreground">分类颜色和匹配规则</p>
                        </div>
                        <Switch checked={configTypes.categories} onCheckedChange={(checked) => toggleConfigType("categories", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Webhook 与事件绑定</p>
                          <p className="text-xs text-muted-foreground">Webhook 配置和事件触发绑定</p>
                        </div>
                        <Switch checked={configTypes.webhooks} onCheckedChange={(checked) => toggleConfigType("webhooks", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">定时任务</p>
                          <p className="text-xs text-muted-foreground">定时任务的 Cron 表达式、启用状态和参数配置</p>
                        </div>
                        <Switch checked={configTypes.scheduled_tasks} onCheckedChange={(checked) => toggleConfigType("scheduled_tasks", checked)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">提示词配置</p>
                          <p className="text-xs text-muted-foreground">自定义提示词模板</p>
                        </div>
                        <Switch checked={configTypes.prompts} onCheckedChange={(checked) => toggleConfigType("prompts", checked)} />
                      </div>
                    </div>
                  )}
                </div>
                {importConfig && selectedConfigTypes.length === 0 && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                    请至少勾选一种配置类型，否则只会导入日志数据。
                  </p>
                )}
                {!mergeLogs && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                    ⚠ 替换模式将清空所有现有日志数据，此操作不可撤销！
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>确认导入</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
