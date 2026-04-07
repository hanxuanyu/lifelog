import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Info, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getVersion, checkUpdate, type UpdateInfo } from "@/api"
import { toast } from "sonner"

export function VersionInfoCard() {
  const [versionInfo, setVersionInfo] = useState<{ version: string; commit: string } | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => { getVersion().then(setVersionInfo).catch(() => {}) }, [])

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const info = await checkUpdate()
      setUpdateInfo(info)
      if (!info.has_update) toast.success("已是最新版本")
    } catch { toast.error("检查更新失败") }
    finally { setCheckingUpdate(false) }
  }

  if (!versionInfo) return null

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> 关于
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">版本</span>
            <span className="font-mono">{versionInfo.version}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">构建</span>
            <a href={`https://github.com/hanxuanyu/lifelog/commit/${versionInfo.commit}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-primary hover:underline flex items-center gap-1">
              {versionInfo.commit}<ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">更新</span>
            <div className="flex items-center gap-2">
              {updateInfo?.has_update && (
                <a href={updateInfo.release_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  {updateInfo.latest_version} 可用<ExternalLink className="h-3 w-3" />
                </a>
              )}
              {updateInfo && !updateInfo.has_update && (
                <span className="text-xs text-muted-foreground">已是最新</span>
              )}
              <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                onClick={handleCheckUpdate} disabled={checkingUpdate}>
                {checkingUpdate ? "检查中..." : "检查更新"}
              </Button>
            </div>
          </div>
          <div className="pt-1 flex items-center gap-3">
            <a href="https://github.com/hanxuanyu/lifelog" target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
              <ExternalLink className="h-3 w-3" />GitHub
            </a>
            <a href="/swagger/index.html" target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
              <ExternalLink className="h-3 w-3" />API 文档
            </a>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
