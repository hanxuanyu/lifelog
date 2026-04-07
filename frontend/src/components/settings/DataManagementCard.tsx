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
import { toast } from "sonner"

interface DataManagementCardProps {
  onImportComplete: () => void
}

export function DataManagementCard({ onImportComplete }: DataManagementCardProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [mergeLogs, setMergeLogs] = useState(true)
  const [importConfig, setImportConfig] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const res = await importData(selectedFile, mergeLogs, importConfig)
      const d = res.data
      const parts: string[] = []
      if (d?.logs_total != null) {
        parts.push(`共 ${d.logs_total} 条日志`)
        parts.push(`导入 ${d.logs_imported ?? 0} 条`)
        if (d.logs_skipped) parts.push(`跳过 ${d.logs_skipped} 条`)
      }
      if (d?.config_imported) parts.push("配置已导入")
      if (d?.config_error) parts.push(`配置错误: ${d.config_error}`)
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
            <p className="text-[10px] text-muted-foreground">导出包含全部日志记录和分类配置的 zip 压缩包，可用于备份或迁移</p>
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
                      <p className="text-xs text-muted-foreground">包括时间模式和分类规则，将覆盖当前配置</p>
                    </div>
                    <Switch checked={importConfig} onCheckedChange={setImportConfig} />
                  </div>
                </div>
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
