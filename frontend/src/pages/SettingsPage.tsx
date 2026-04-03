import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Plus, Trash2, Save, Lock, Eye, EyeOff,
  Server, Clock, Shield, Tag, X, Keyboard,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getCategories, getSettings, setPassword,
  updateSettings, updateCategories,
} from "@/api"
import type { Category } from "@/types"
import { toast } from "@/hooks/use-toast"
import { getShortcut, setShortcut, formatShortcut } from "@/hooks/use-shortcut"

export function SettingsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Settings state
  const [timePointMode, setTimePointMode] = useState("end")
  const [serverPort, setServerPort] = useState(8080)
  const [dbPath, setDbPath] = useState("./data/lifelog.db")
  const [jwtExpireHours, setJwtExpireHours] = useState(168)
  const [origSettings, setOrigSettings] = useState({ timePointMode: "end", serverPort: 8080, dbPath: "", jwtExpireHours: 168 })

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
    toast({ title: "快捷键已更新", description: formatShortcut(newShortcut) })
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
        setOrigSettings({
          timePointMode: settings?.time_point_mode || "end",
          serverPort: settings?.server?.port || 8080,
          dbPath: settings?.server?.db_path || "./data/lifelog.db",
          jwtExpireHours: settings?.auth?.jwt_expire_hours || 168,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const settingsDirty =
    timePointMode !== origSettings.timePointMode ||
    serverPort !== origSettings.serverPort ||
    dbPath !== origSettings.dbPath ||
    jwtExpireHours !== origSettings.jwtExpireHours

  const categoriesDirty = JSON.stringify(categories) !== JSON.stringify(origCategories)

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const req: Record<string, unknown> = {}
      if (timePointMode !== origSettings.timePointMode) req.time_point_mode = timePointMode
      if (serverPort !== origSettings.serverPort) req.server_port = serverPort
      if (dbPath !== origSettings.dbPath) req.server_db_path = dbPath
      if (jwtExpireHours !== origSettings.jwtExpireHours) req.jwt_expire_hours = jwtExpireHours

      const res = await updateSettings(req)
      const needRestart = res.data?.need_restart
      setOrigSettings({ timePointMode, serverPort, dbPath, jwtExpireHours })

      if (needRestart) {
        toast({ title: "配置已保存", description: "端口、数据库路径或JWT过期时间的变更需要重启服务后生效" })
      } else {
        toast({ title: "配置已保存并实时生效" })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast({ title: "错误", description: msg, variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveCategories = async () => {
    setSavingCategories(true)
    try {
      await updateCategories(categories)
      setOrigCategories(JSON.parse(JSON.stringify(categories)))
      toast({ title: "分类规则已保存并实时生效" })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast({ title: "错误", description: msg, variant: "destructive" })
    } finally {
      setSavingCategories(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast({ title: "新密码至少4位", variant: "destructive" })
      return
    }
    setChangingPw(true)
    try {
      await setPassword(oldPassword, newPassword)
      toast({ title: "密码修改成功" })
      setOldPassword("")
      setNewPassword("")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "修改失败"
      toast({ title: "错误", description: msg, variant: "destructive" })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-20 sm:pb-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4 max-w-5xl mx-auto w-full"
      >
        <Button size="icon" variant="ghost" onClick={() => navigate("/", { replace: true })} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">设置</h1>
      </motion.div>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
            {/* Left column: Settings */}
            <div className="space-y-4">
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
                  <CardContent className="space-y-3">
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
                    <Button size="sm" onClick={handlePasswordChange} disabled={changingPw || !newPassword} className="w-full">
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {changingPw ? "保存中..." : "保存密码"}
                    </Button>
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
                          toast({ title: "已恢复默认快捷键" })
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
                            key={catIdx}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rounded-lg border p-3 space-y-3"
                          >
                            <div className="flex items-center gap-2">
                              <label
                                className="w-8 h-8 rounded-md border border-input cursor-pointer shrink-0 shadow-sm"
                                style={{ backgroundColor: cat.color || "#6b7280" }}
                              >
                                <input
                                  type="color"
                                  value={cat.color || "#6b7280"}
                                  onChange={(e) => updateCategoryColor(catIdx, e.target.value)}
                                  className="sr-only"
                                />
                              </label>
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
      </ScrollArea>
    </div>
  )
}
