import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getShortcut, setShortcut, formatShortcut } from "@/hooks/use-shortcut"
import { toast } from "sonner"

export function ShortcutCard() {
  const [shortcutValue, setShortcutValue] = useState(getShortcut())
  const [recordingShortcut, setRecordingShortcut] = useState(false)

  const handleShortcutKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!recordingShortcut) return
    e.preventDefault(); e.stopPropagation()
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Keyboard className="h-4 w-4" /> 快捷键</CardTitle>
          <CardDescription className="text-xs">快速打开新增日志弹窗的键盘快捷键</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div tabIndex={0} onKeyDown={handleShortcutKeyDown} onBlur={() => setRecordingShortcut(false)}
              onClick={() => setRecordingShortcut(true)}
              className={`flex-1 h-9 px-3 rounded-md border text-sm flex items-center cursor-pointer transition-colors ${
                recordingShortcut ? "border-primary ring-2 ring-ring/50 bg-accent text-foreground" : "border-input bg-transparent text-foreground hover:bg-accent"
              }`}>
              {recordingShortcut
                ? <span className="text-muted-foreground animate-pulse">请按下快捷键组合...</span>
                : <kbd className="font-mono text-xs">{formatShortcut(shortcutValue)}</kbd>}
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              const defaultKey = "ctrl+shift+n"
              setShortcutValue(defaultKey); setShortcut(defaultKey); setRecordingShortcut(false)
              toast.success("已恢复默认快捷键")
            }}>重置</Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">点击上方区域后按下新的快捷键组合即可修改</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
