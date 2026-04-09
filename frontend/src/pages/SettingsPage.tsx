import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Save, Info, Settings2, Webhook, Zap, Tags } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getSettings, updateSettings } from "@/api"
import { toast } from "sonner"
import { VersionInfoCard } from "@/components/settings/VersionInfoCard"
import { ServerMonitorCard } from "@/components/settings/ServerMonitorCard"
import { TimePointModeCard } from "@/components/settings/TimePointModeCard"
import { ServerConfigCard } from "@/components/settings/ServerConfigCard"
import { AuthConfigCard } from "@/components/settings/AuthConfigCard"
import { MCPServiceCard } from "@/components/settings/MCPServiceCard"
import { PasswordCard } from "@/components/settings/PasswordCard"
import { ShortcutCard } from "@/components/settings/ShortcutCard"
import { DataManagementCard } from "@/components/settings/DataManagementCard"
import { AIProviderSettings } from "@/components/settings/AIProviderSettings"
import { CategoriesCard } from "@/components/settings/CategoriesCard"
import { WebhookSettingsCard } from "@/components/settings/WebhookSettingsCard"
import { EventBindingsCard } from "@/components/settings/EventBindingsCard"

export function SettingsPage() {
  const [loading, setLoading] = useState(true)

  // Settings save group
  const [timePointMode, setTimePointMode] = useState("end")
  const [serverPort, setServerPort] = useState(8080)
  const [dbPath, setDbPath] = useState("./data/lifelog.db")
  const [jwtExpireHours, setJwtExpireHours] = useState(168)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [mcpPort, setMcpPort] = useState(8081)
  const [origSettings, setOrigSettings] = useState({
    timePointMode: "end", serverPort: 8080, dbPath: "", jwtExpireHours: 168, mcpEnabled: false, mcpPort: 8081,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setTimePointMode(settings?.time_point_mode || "end")
        setServerPort(settings?.server?.port || 8080)
        setDbPath(settings?.server?.db_path || "./data/lifelog.db")
        setJwtExpireHours(settings?.auth?.jwt_expire_hours || 168)
        setMcpEnabled(settings?.mcp?.enabled || false)
        setMcpPort(settings?.mcp?.port || 8081)
        setOrigSettings({
          timePointMode: settings?.time_point_mode || "end",
          serverPort: settings?.server?.port || 8080,
          dbPath: settings?.server?.db_path || "./data/lifelog.db",
          jwtExpireHours: settings?.auth?.jwt_expire_hours || 168,
          mcpEnabled: settings?.mcp?.enabled || false,
          mcpPort: settings?.mcp?.port || 8081,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const settingsDirty =
    timePointMode !== origSettings.timePointMode ||
    serverPort !== origSettings.serverPort ||
    dbPath !== origSettings.dbPath ||
    jwtExpireHours !== origSettings.jwtExpireHours ||
    mcpEnabled !== origSettings.mcpEnabled ||
    mcpPort !== origSettings.mcpPort

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const req: Record<string, unknown> = {}
      if (timePointMode !== origSettings.timePointMode) req.time_point_mode = timePointMode
      if (serverPort !== origSettings.serverPort) req.server_port = serverPort
      if (dbPath !== origSettings.dbPath) req.server_db_path = dbPath
      if (jwtExpireHours !== origSettings.jwtExpireHours) req.jwt_expire_hours = jwtExpireHours
      if (mcpEnabled !== origSettings.mcpEnabled) req.mcp_enabled = mcpEnabled
      if (mcpPort !== origSettings.mcpPort) req.mcp_port = mcpPort
      const res = await updateSettings(req)
      setOrigSettings({ timePointMode, serverPort, dbPath, jwtExpireHours, mcpEnabled, mcpPort })
      if (res.data?.need_restart) {
        toast.success("配置已保存", { description: "端口、数据库路径或JWT过期时间的变更需要重启服务后生效" })
      } else { toast.success("配置已保存并实时生效") }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
    } finally { setSavingSettings(false) }
  }

  const handleImportComplete = () => {
    setRefreshKey((k) => k + 1)
    getSettings().then((settings) => {
      setTimePointMode(settings?.time_point_mode || "end")
      setServerPort(settings?.server?.port || 8080)
      setDbPath(settings?.server?.db_path || "./data/lifelog.db")
      setJwtExpireHours(settings?.auth?.jwt_expire_hours || 168)
      setMcpEnabled(settings?.mcp?.enabled || false)
      setMcpPort(settings?.mcp?.port || 8081)
      setOrigSettings({
        timePointMode: settings?.time_point_mode || "end",
        serverPort: settings?.server?.port || 8080,
        dbPath: settings?.server?.db_path || "./data/lifelog.db",
        jwtExpireHours: settings?.auth?.jwt_expire_hours || 168,
        mcpEnabled: settings?.mcp?.enabled || false,
        mcpPort: settings?.mcp?.port || 8081,
      })
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center app-min-view-height">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-40 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-4 w-full pt-4 pb-3">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-lg font-semibold">设置</h1>
          </motion.div>
        </div>
      </div>
      <div className="pt-14" />
      <div className="max-w-5xl mx-auto px-4 w-full">
        <div style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <Tabs defaultValue="app-info">
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="app-info" className="gap-1.5">
                <Info className="h-4 w-4" /><span className="hidden sm:inline">设置首页</span>
              </TabsTrigger>
              <TabsTrigger value="basic" className="gap-1.5">
                <Settings2 className="h-4 w-4" /><span className="hidden sm:inline">基础配置</span>
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-1.5">
                <Webhook className="h-4 w-4" /><span className="hidden sm:inline">Webhook</span>
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-1.5">
                <Zap className="h-4 w-4" /><span className="hidden sm:inline">事件绑定</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5">
                <Tags className="h-4 w-4" /><span className="hidden sm:inline">分类管理</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="app-info">
              <div className="space-y-4">
                <VersionInfoCard />
                <ServerMonitorCard />
                <PasswordCard />
                <DataManagementCard onImportComplete={handleImportComplete} />
                <ShortcutCard />
              </div>
            </TabsContent>

            <TabsContent value="basic">
              <div className="space-y-4">
                <TimePointModeCard value={timePointMode} onChange={setTimePointMode} />
                <ServerConfigCard serverPort={serverPort} onServerPortChange={setServerPort} dbPath={dbPath} onDbPathChange={setDbPath} />
                <AuthConfigCard jwtExpireHours={jwtExpireHours} onJwtExpireHoursChange={setJwtExpireHours} />
                <MCPServiceCard mcpEnabled={mcpEnabled} onMcpEnabledChange={setMcpEnabled} mcpPort={mcpPort} onMcpPortChange={setMcpPort} />
                <AnimatePresence>
                  {settingsDirty && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
                        <Save className="h-4 w-4 mr-1.5" />{savingSettings ? "保存中..." : "保存配置"}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AIProviderSettings />
              </div>
            </TabsContent>

            <TabsContent value="webhooks">
              <WebhookSettingsCard />
            </TabsContent>

            <TabsContent value="events">
              <EventBindingsCard />
            </TabsContent>

            <TabsContent value="categories">
              <CategoriesCard refreshKey={refreshKey} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
