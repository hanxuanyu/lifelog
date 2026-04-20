import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Monitor, Smartphone, Globe, LogOut, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getOnlineDevices, disconnectDevice } from "@/api"
import type { OnlineDevice } from "@/api"
import { toast } from "sonner"

function parseUA(ua: string): { device: string; browser: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  let browser = "未知浏览器"
  if (/Edg\//i.test(ua)) browser = "Edge"
  else if (/Chrome\//i.test(ua)) browser = "Chrome"
  else if (/Firefox\//i.test(ua)) browser = "Firefox"
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"

  let os = ""
  if (/Windows/i.test(ua)) os = "Windows"
  else if (/Mac OS/i.test(ua)) os = "macOS"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/iPhone|iPad/i.test(ua)) os = "iOS"
  else if (/Linux/i.test(ua)) os = "Linux"

  const device = os ? `${os} · ${browser}` : browser
  return { device, browser: isMobile ? "mobile" : "desktop" }
}

function formatDuration(connectedAt: string): string {
  const diff = Date.now() - new Date(connectedAt).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚连接"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export function OnlineDevicesCard() {
  const [devices, setDevices] = useState<OnlineDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    try {
      const data = await getOnlineDevices()
      setDevices(data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [fetchDevices])

  const handleDisconnect = async (id: string) => {
    setDisconnecting(id)
    try {
      await disconnectDevice(id)
      toast.success("设备已断开")
      setDevices((prev) => prev.filter((d) => d.id !== id))
    } catch {
      toast.error("断开失败")
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            在线设备
            <span className="text-xs text-muted-foreground font-normal">
              ({devices.length})
            </span>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchDevices}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无在线设备</p>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => {
              const { device: deviceName, browser } = parseUA(device.user_agent)
              const Icon = browser === "mobile" ? Smartphone : Monitor
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{deviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.ip} · {formatDuration(device.connected_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    disabled={disconnecting === device.id}
                    onClick={() => handleDisconnect(device.id)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
