import { motion } from "framer-motion"
import { LayoutTemplate, Rows3, Smartphone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { NavigationStyle } from "@/hooks/use-navigation-style"

interface NavigationStyleCardProps {
  value: NavigationStyle
  onChange: (style: NavigationStyle) => void
}

const options: Array<{
  value: NavigationStyle
  label: string
  description: string
}> = [
  {
    value: "auto",
    label: "自动（推荐）",
    description: "桌面端使用顶部导航，移动端使用底部标签栏和中央 FAB，兼顾效率与单手操作。",
  },
  {
    value: "top",
    label: "顶部导航",
    description: "所有设备都优先使用顶部操作按钮，适合更熟悉传统导航栏的使用方式。",
  },
  {
    value: "floating",
    label: "悬浮按钮",
    description: "移动端使用右下角悬浮操作组，适合偏好极简画面的使用方式。",
  },
]

function getOptionIcon(style: NavigationStyle) {
  switch (style) {
    case "auto":
      return <Smartphone className="h-4 w-4" />
    case "top":
      return <Rows3 className="h-4 w-4" />
    default:
      return <LayoutTemplate className="h-4 w-4" />
  }
}

export function NavigationStyleCard({ value, onChange }: NavigationStyleCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" />
            导航样式
          </CardTitle>
          <CardDescription className="text-xs">
            控制移动端的主要入口布局。此偏好会立即生效，并仅保存在当前浏览器。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {options.map((option) => {
            const active = value === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/6 text-foreground shadow-sm"
                    : "border-border bg-background hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {getOptionIcon(option.value)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}
