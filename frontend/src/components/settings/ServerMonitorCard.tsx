import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Activity, Cpu, HardDrive, Clock, Layers, FolderOpen, MemoryStick, Gauge } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSystemMonitor } from "@/api"
import type { SystemMonitor } from "@/types"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i]
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}时`)
  parts.push(`${m}分`)
  return parts.join(" ")
}

function getBarColor(percent: number): string {
  if (percent < 60) return "bg-emerald-500"
  if (percent < 80) return "bg-amber-500"
  return "bg-red-500"
}

function ProgressBar({ percent, label, detail }: { percent: number; label: string; detail: string }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{detail}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getBarColor(clamped)}`}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function StatItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-mono truncate">{value}</div>
      </div>
    </div>
  )
}

export function ServerMonitorCard() {
  const [monitor, setMonitor] = useState<SystemMonitor | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getSystemMonitor().then(setMonitor).catch(() => {})
    intervalRef.current = setInterval(() => {
      getSystemMonitor().then(setMonitor).catch(() => {})
    }, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (!monitor) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> 服务器监控
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-4">加载中...</div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="space-y-4">
        {/* 资源使用率 - 进度条 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4" /> 资源使用率
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {monitor.cpu_usage >= 0 && (
              <ProgressBar
                percent={monitor.cpu_usage}
                label={`CPU (${monitor.cpu_cores} 核)`}
                detail={`${monitor.cpu_usage.toFixed(1)}%`}
              />
            )}
            {monitor.os_mem_total > 0 && (
              <ProgressBar
                percent={monitor.os_mem_percent}
                label="系统内存"
                detail={`${formatBytes(monitor.os_mem_used)} / ${formatBytes(monitor.os_mem_total)}`}
              />
            )}
            {monitor.disk_total > 0 && (
              <ProgressBar
                percent={monitor.disk_percent}
                label="磁盘"
                detail={`${formatBytes(monitor.disk_used)} / ${formatBytes(monitor.disk_total)}`}
              />
            )}
          </CardContent>
        </Card>

        {/* 运行状态 - 网格 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> 运行状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatItem icon={Clock} label="运行时间" value={formatUptime(monitor.uptime_seconds)} />
              <StatItem icon={Layers} label="Goroutines" value={String(monitor.goroutines)} />
              <StatItem icon={Cpu} label="Go 版本" value={monitor.go_version} />
              <StatItem icon={MemoryStick} label="Go 堆内存" value={formatBytes(monitor.go_mem_alloc)} />
              <StatItem icon={MemoryStick} label="Go 系统内存" value={formatBytes(monitor.go_mem_sys)} />
              <StatItem icon={Activity} label="GC 次数" value={String(monitor.go_gc_count)} />
            </div>
          </CardContent>
        </Card>

        {/* 目录信息 */}
        {monitor.directories && monitor.directories.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> 目录信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monitor.directories.map(dir => (
                  <div key={dir.label} className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <HardDrive className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{dir.label}</span>
                        {dir.exists ? (
                          <span className="text-xs font-mono text-muted-foreground">{formatBytes(dir.size_bytes)} / {dir.file_count} 文件</span>
                        ) : (
                          <span className="text-xs text-destructive">不存在</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={dir.path}>{dir.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
