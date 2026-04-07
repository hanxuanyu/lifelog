import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Trash2, Save, Lock, Eye, EyeOff,
  Server, Clock, Shield, Tag, X, Keyboard,
  Download, Upload, Database, Plug, Info, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getCategories, getSettings, setPassword,
  updateSettings, updateCategories, exportData, importData,
  getVersion, checkUpdate, type UpdateInfo,
} from "@/api"
import type { Category } from "@/types"
import { toast } from "sonner"
import { getShortcut, setShortcut, formatShortcut } from "@/hooks/use-shortcut"
import { Switch } from "@/components/ui/switch"
import { AIProviderSettings } from "@/components/settings/AIProviderSettings"

export function SettingsPage() {
  const [loading, setLoading] = useState(true)

  // Settings state
  const [timePointMode, setTimePointMode] = useState("end")
  const [serverPort, setServerPort] = useState(8080)
  const [dbPath, setDbPath] = useState("./data/lifelog.db")
  const [jwtExpireHours, setJwtExpireHours] = useState(168)
  const [origSettings, setOrigSettings] = useState({ timePointMode: "end", serverPort: 8080, dbPath: "", jwtExpireHours: 168, mcpEnabled: false, mcpPort: 8081 })

  // MCP state
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [mcpPort, setMcpPort] = useState(8081)

  // Password state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  // Categories state
  const [categories, setCategoriesState] = useState<Category[]>([])
  const [origCategories, setOrigCategories] = useState<Category[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingCategories, setSavingCategories] = useState(false)
  const [modeDialogOpen, setModeDialogOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<string | null>(null)

  // Shortcut state
  const [shortcutValue, setShortcutValue] = useState(getShortcut())
  const [recordingShortcut, setRecordingShortcut] = useState(false)

  // Export/Import state
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [mergeLogs, setMergeLogs] = useState(true)
  const [importConfig, setImportConfig] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Version state
  const [versionInfo, setVersionInfo] = useState<{ version: string; commit: string } | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const handleShortcutKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!recordingShortcut) return
    e.preventDefault()
    e.stopPropagation()

    // Ignore modifier-only presses
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return

    const parts: string[] = []
    if (e.ctrlKey) parts.push("ctrl")
    if (e.shiftKey) parts.push("shift")
    if (e.altKey) parts.push("alt")
    if (e.metaKey) parts.push("meta")
    parts.push(e.key.toLowerCase())

    const newShortcut = parts.join("+")
    setShortcutValue(newShortcut)
    setShortcut(newShortcut)
    setRecordingShortcut(false)
    toast.success("快捷键已更新", { description: formatShortcut(newShortcut) })
  }, [recordingShortcut])

  useEffect(() => {
    Promise.all([getCategories(), getSettings()])
      .then(([cats, settings]) => {
        const c = cats || []
        setCategoriesState(c)
        setOrigCategories(JSON.parse(JSON.stringify(c)))
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
    getVersion().then(setVersionInfo).catch(() => {})
  }, [])

  const settingsDirty =
    timePointMode !== origSettings.timePointMode ||
    serverPort !== origSettings.serverPort ||
    dbPath !== origSettings.dbPath ||
    jwtExpireHours !== origSettings.jwtExpireHours ||
    mcpEnabled !== origSettings.mcpEnabled ||
    mcpPort !== origSettings.mcpPort

  const categoriesDirty = JSON.stringify(categories) !== JSON.stringify(origCategories)

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const info = await checkUpdate()
      setUpdateInfo(info)
      if (!info.has_update) toast.success("已是最新版本")
    } catch {
      toast.error("检查更新失败")
    } finally {
      setCheckingUpdate(false)
    }
  }

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
      const needRestart = res.data?.need_restart
      setOrigSettings({ timePointMode, serverPort, dbPath, jwtExpireHours, mcpEnabled, mcpPort })

      if (needRestart) {
        toast.success("配置已保存", { description: "端口、数据库路径或JWT过期时间的变更需要重启服务后生效" })
      } else {
        toast.success("配置已保存并实时生效")
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveCategories = async () => {
    setSavingCategories(true)
    try {
      await updateCategories(categories)
      setOrigCategories(JSON.parse(JSON.stringify(categories)))
      toast.success("分类规则已保存并实时生效")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
    } finally {
      setSavingCategories(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error("新密码至少4位")
      return
    }
    setChangingPw(true)
    try {
      await setPassword(oldPassword, newPassword)
      toast.success("密码修改成功")
      setOldPassword("")
      setNewPassword("")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "修改失败"
      toast.error("修改失败", { description: msg })
    } finally {
      setChangingPw(false)
    }
  }

  const addCategory = () => {
    setCategoriesState([...categories, { name: "", color: "#6b7280", rules: [{ type: "fixed", pattern: "" }] }])
  }

  const removeCategory = (index: number) => {
    setCategoriesState(categories.filter((_, i) => i !== index))
  }

  const updateCategoryName = (index: number, name: string) => {
    const updated = [...categories]
    updated[index] = { ...updated[index], name }
    setCategoriesState(updated)
  }

  const updateCategoryColor = (index: number, color: string) => {
    const updated = [...categories]
    updated[index] = { ...updated[index], color }
    setCategoriesState(updated)
  }

  const addRule = (catIndex: number) => {
    const updated = [...categories]
    updated[catIndex] = {
      ...updated[catIndex],
      rules: [...updated[catIndex].rules, { type: "fixed", pattern: "" }],
    }
    setCategoriesState(updated)
  }

  const removeRule = (catIndex: number, ruleIndex: number) => {
    const updated = [...categories]
    updated[catIndex] = {
      ...updated[catIndex],
      rules: updated[catIndex].rules.filter((_, i) => i !== ruleIndex),
    }
    setCategoriesState(updated)
  }

  const updateRule = (catIndex: number, ruleIndex: number, field: "type" | "pattern", value: string) => {
    const updated = [...categories]
    const rules = [...updated[catIndex].rules]
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value }
    updated[catIndex] = { ...updated[catIndex], rules }
    setCategoriesState(updated)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportData()
      toast.success("数据导出成功")
    } catch {
      toast.error("导出失败")
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".zip")) {
      toast.error("请选择 zip 格式的文件")
      return
    }
    setSelectedFile(file)
    setImportDialogOpen(true)
    // reset so the same file can be re-selected
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
      // Refresh settings and categories after import
      Promise.all([getCategories(), getSettings()])
        .then(([cats, settings]) => {
          const c = cats || []
          setCategoriesState(c)
          setOrigCategories(JSON.parse(JSON.stringify(c)))
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "导入失败"
      toast.error("导入失败", { description: msg })
    } finally {
      setImporting(false)
      setSelectedFile(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center app-min-view-height">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div>
    <div className="fixed top-0 left-0 right-0 z-40 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-5xl mx-auto px-4 w-full pt-4 pb-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-lg font-semibold">设置</h1>
        </motion.div>
      </div>
    </div>
    {/* Spacer for fixed header */}
    <div className="pt-14" />
    <div className="max-w-5xl mx-auto px-4 w-full">
      <div style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
            {/* Left column: Settings */}
            <div className="space-y-4">
              {/* Version Info */}
              {versionInfo && (
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
                        <a
                          href={`https://github.com/hanxuanyu/lifelog/commit/${versionInfo.commit}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          {versionInfo.commit}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">更新</span>
                        <div className="flex items-center gap-2">
                          {updateInfo?.has_update && (
                            <a
                              href={updateInfo.release_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              {updateInfo.latest_version} 可用
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {updateInfo && !updateInfo.has_update && (
                            <span className="text-xs text-muted-foreground">已是最新</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={handleCheckUpdate}
                            disabled={checkingUpdate}
                          >
                            {checkingUpdate ? "检查中..." : "检查更新"}
                          </Button>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center gap-3">
                        <a
                          href="https://github.com/hanxuanyu/lifelog"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          GitHub
                        </a>
                        <a
                          href="/swagger/index.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          API 文档
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Time Point Mode */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" /> 时间记录模式
                    </CardTitle>
                    <CardDescription className="text-xs">
                      决定记录的时间代表事项的开始还是结束（保存后实时生效）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant={timePointMode === "end" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (timePointMode !== "end") {
                            setPendingMode("end")
                            setModeDialogOpen(true)
                          }
                        }}
                      >
                        结束时间
                      </Button>
                      <Button
                        variant={timePointMode === "start" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (timePointMode !== "start") {
                            setPendingMode("start")
                            setModeDialogOpen(true)
                          }
                        }}
                      >
                        开始时间
                      </Button>
                    </div>
                    <AlertDialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>切换时间记录模式</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <p>切换后，新记录的日志将使用新模式标记。</p>
                            <p>已有日志不受影响——每条日志已保存了创建时的模式信息，统计分析时会按各自模式正确计算。</p>
                            <p className="text-amber-600 dark:text-amber-400">注意：早期未标记模式的日志将使用当前全局设置来解读，切换后这部分日志的时长统计可能发生变化。</p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setPendingMode(null)}>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            if (pendingMode) setTimePointMode(pendingMode)
                            setPendingMode(null)
                          }}>确认切换</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Server config */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Server className="h-4 w-4" /> 服务器配置
                    </CardTitle>
                    <CardDescription className="text-xs">
                      修改后需要重启服务才能生效
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">端口</Label>
                      <Input
                        type="number"
                        value={serverPort}
                        onChange={(e) => setServerPort(parseInt(e.target.value) || 8080)}
                        min={1}
                        max={65535}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">数据库路径</Label>
                      <Input
                        value={dbPath}
                        onChange={(e) => setDbPath(e.target.value)}
                        placeholder="./data/lifelog.db"
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Auth config */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" /> 认证配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">JWT 过期时间（小时）</Label>
                      <Input
                        type="number"
                        value={jwtExpireHours}
                        onChange={(e) => setJwtExpireHours(parseInt(e.target.value) || 168)}
                        min={1}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        修改后需要重启生效，当前约 {Math.round(jwtExpireHours / 24)} 天
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* MCP 配置 */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Plug className="h-4 w-4" /> MCP 服务
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Model Context Protocol 服务，允许 AI 助手查询日志数据
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">启用 MCP 服务</Label>
                      <Switch checked={mcpEnabled} onCheckedChange={setMcpEnabled} />
                    </div>
                    {mcpEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">MCP 端口</Label>
                        <Input
                          type="number"
                          value={mcpPort}
                          onChange={(e) => setMcpPort(parseInt(e.target.value) || 8081)}
                          min={1}
                          max={65535}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          SSE 端点: http://localhost:{mcpPort}/sse，修改后需重启生效
                        </p>
                        {mcpEnabled && (
                          <p className="text-[10px] text-muted-foreground">
                            已设置密码时，MCP 连接需携带 Bearer Token 认证
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Save settings button */}
              <AnimatePresence>
                {settingsDirty && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
                      <Save className="h-4 w-4 mr-1.5" />
                      {savingSettings ? "保存中..." : "保存配置"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lock className="h-4 w-4" /> 密码管理
                    </CardTitle>
                    <CardDescription className="text-xs">设置或修改访问密码</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange() }} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">旧密码</Label>
                      <div className="relative">
                        <Input
                          type={showOldPw ? "text" : "password"}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="首次设置可留空"
                          className="pr-9"
                        />
                        <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowOldPw(!showOldPw)}>
                          {showOldPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">新密码</Label>
                      <div className="relative">
                        <Input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="至少4位"
                          className="pr-9"
                        />
                        <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                          {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" size="sm" disabled={changingPw || !newPassword} className="w-full">
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {changingPw ? "保存中..." : "保存密码"}
                    </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Keyboard shortcut */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Keyboard className="h-4 w-4" /> 快捷键
                    </CardTitle>
                    <CardDescription className="text-xs">
                      快速打开新增日志弹窗的键盘快捷键
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div
                        tabIndex={0}
                        onKeyDown={handleShortcutKeyDown}
                        onBlur={() => setRecordingShortcut(false)}
                        onClick={() => setRecordingShortcut(true)}
                        className={`flex-1 h-9 px-3 rounded-md border text-sm flex items-center cursor-pointer transition-colors ${
                          recordingShortcut
                            ? "border-primary ring-2 ring-ring/50 bg-accent text-foreground"
                            : "border-input bg-transparent text-foreground hover:bg-accent"
                        }`}
                      >
                        {recordingShortcut ? (
                          <span className="text-muted-foreground animate-pulse">请按下快捷键组合...</span>
                        ) : (
                          <kbd className="font-mono text-xs">{formatShortcut(shortcutValue)}</kbd>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const defaultKey = "ctrl+shift+n"
                          setShortcutValue(defaultKey)
                          setShortcut(defaultKey)
                          setRecordingShortcut(false)
                          toast.success("已恢复默认快捷键")
                        }}
                      >
                        重置
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      点击上方区域后按下新的快捷键组合即可修改
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Data Management */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" /> 数据管理
                    </CardTitle>
                    <CardDescription className="text-xs">
                      导出或导入全量日志数据与配置
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {exporting ? "导出中..." : "导出数据"}
                    </Button>
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {importing ? "导入中..." : "导入数据"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      导出包含全部日志记录和分类配置的 zip 压缩包，可用于备份或迁移
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* AI Provider Settings */}
              <AIProviderSettings />

              {/* Import confirmation dialog */}
              <AlertDialog open={importDialogOpen} onOpenChange={(open) => {
                setImportDialogOpen(open)
                if (!open) setSelectedFile(null)
              }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>导入数据</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          即将导入文件：<span className="font-medium text-foreground">{selectedFile?.name}</span>
                        </p>
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">保留现有数据</p>
                              <p className="text-xs text-muted-foreground">
                                开启后将合并导入，自动跳过重复记录；关闭则清空现有数据后导入
                              </p>
                            </div>
                            <Switch checked={mergeLogs} onCheckedChange={setMergeLogs} />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">导入配置</p>
                              <p className="text-xs text-muted-foreground">
                                包括时间模式和分类规则，将覆盖当前配置
                              </p>
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
                    <AlertDialogAction onClick={handleImportConfirm}>
                      确认导入
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Right column: Categories */}
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Tag className="h-4 w-4" /> 分类规则
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          编辑分类及匹配规则（保存后实时生效）
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={addCategory}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> 添加分类
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {categories.map((cat, catIdx) => (
                          <motion.div
                            key={cat.name || `cat-${catIdx}`}
                            layout="position"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rounded-lg border p-3 space-y-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative w-8 h-8 shrink-0">
                                <div
                                  className="w-8 h-8 rounded-md border border-input shadow-sm"
                                  style={{ backgroundColor: cat.color || "#6b7280" }}
                                />
                                <input
                                  type="color"
                                  value={cat.color || "#6b7280"}
                                  onChange={(e) => updateCategoryColor(catIdx, e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                              </div>
                              <Input
                                value={cat.name}
                                onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                                placeholder="分类名称"
                                className="font-medium text-sm flex-1"
                              />
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => removeCategory(catIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-2 pl-2 border-l-2 border-muted ml-1">
                              <AnimatePresence mode="popLayout">
                                {cat.rules.map((rule, ruleIdx) => (
                                  <motion.div
                                    key={ruleIdx}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex items-center gap-2"
                                  >
                                    <select
                                      value={rule.type}
                                      onChange={(e) => updateRule(catIdx, ruleIdx, "type", e.target.value)}
                                      className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0 w-[68px]"
                                    >
                                      <option value="fixed">精确</option>
                                      <option value="regex">正则</option>
                                    </select>
                                    <Input
                                      value={rule.pattern}
                                      onChange={(e) => updateRule(catIdx, ruleIdx, "pattern", e.target.value)}
                                      placeholder={rule.type === "fixed" ? "精确匹配值" : "正则表达式"}
                                      className="text-xs font-mono flex-1"
                                    />
                                    <Button
                                      size="icon" variant="ghost"
                                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeRule(catIdx, ruleIdx)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                              <Button
                                size="sm" variant="ghost"
                                className="text-xs h-7 text-muted-foreground"
                                onClick={() => addRule(catIdx)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> 添加规则
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          暂无分类规则，点击上方按钮添加
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <AnimatePresence>
                {categoriesDirty && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Button onClick={handleSaveCategories} disabled={savingCategories} className="w-full">
                      <Save className="h-4 w-4 mr-1.5" />
                      {savingCategories ? "保存中..." : "保存分类规则"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
      </div>
    </div>
    </div>
  )
}
