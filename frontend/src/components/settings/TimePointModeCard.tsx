import { useState } from "react"
import { motion } from "framer-motion"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TimePointModeCardProps {
  value: string
  onChange: (mode: string) => void
}

export function TimePointModeCard({ value, onChange }: TimePointModeCardProps) {
  const [modeDialogOpen, setModeDialogOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<string | null>(null)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> 时间记录模式</CardTitle>
          <CardDescription className="text-xs">决定记录的时间代表事项的开始还是结束（保存后实时生效）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant={value === "end" ? "default" : "outline"} size="sm" className="flex-1"
              onClick={() => { if (value !== "end") { setPendingMode("end"); setModeDialogOpen(true) } }}>结束时间</Button>
            <Button variant={value === "start" ? "default" : "outline"} size="sm" className="flex-1"
              onClick={() => { if (value !== "start") { setPendingMode("start"); setModeDialogOpen(true) } }}>开始时间</Button>
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
                <AlertDialogAction onClick={() => { if (pendingMode) onChange(pendingMode); setPendingMode(null) }}>确认切换</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </motion.div>
  )
}
