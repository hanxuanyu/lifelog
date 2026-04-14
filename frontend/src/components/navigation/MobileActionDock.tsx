import React, { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Home, Plus, Sun, Moon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { navigateWithReplace } from "@/lib/navigation"

export function MobileActionDock({ hidden }: { hidden: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"
  const isSettings = location.pathname === "/settings"

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 4500)
    return () => window.clearTimeout(timer)
  }, [open])

  const navTo = (path: string) => {
    navigateWithReplace(navigate, isHome, path)
    setOpen(false)
  }

  const actions = [
    {
      key: "quick-add",
      title: "快速记录",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("openQuickAdd"))
        setOpen(false)
      },
      icon: <Plus className="h-4 w-4" />,
    },
    !isHome ? {
      key: "home",
      title: "首页",
      onClick: () => navTo("/"),
      icon: <Home className="h-4 w-4" />,
    } : null,
    !isStats ? {
      key: "statistics",
      title: "数据统计",
      onClick: () => navTo("/statistics"),
      icon: <BarChart3 className="h-4 w-4" />,
    } : null,
    !isSettings ? {
      key: "settings",
      title: "设置",
      onClick: () => navTo("/settings"),
      icon: <Settings className="h-4 w-4" />,
    } : null,
    {
      key: "theme",
      title: isDark ? "切换浅色模式" : "切换深色模式",
      onClick: () => {
        toggleTheme()
        setOpen(false)
      },
      icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
    },
  ].filter(Boolean) as Array<{
    key: string
    title: string
    onClick: () => void
    icon: React.ReactNode
  }>

  if (hidden) return null

  return (
    <div
      className="sm:hidden fixed right-4 z-50 flex flex-col items-center gap-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.85rem)" }}
    >
      <AnimatePresence initial={false}>
        {open && actions.map((action, index) => (
          <motion.button
            key={action.key}
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ delay: index * 0.04, type: "spring", stiffness: 360, damping: 24 }}
            whileTap={{ scale: 0.92 }}
            onClick={action.onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full border bg-background/92 text-foreground shadow-lg backdrop-blur-md active:scale-95"
            title={action.title}
            aria-label={action.title}
          >
            {action.icon}
          </motion.button>
        ))}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-[3.125rem] w-[3.125rem] items-center justify-center rounded-full shadow-lg active:shadow-xl ${
          open
            ? "border bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
        }`}
        title={open ? "收起快捷操作" : "展开快捷操作"}
        aria-label={open ? "收起快捷操作" : "展开快捷操作"}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 320, damping: 22 }}>
          <Plus className="h-5 w-5" />
        </motion.div>
      </motion.button>
    </div>
  )
}
