import React, { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Home, Plus, Sun, Moon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { StatisticsPage } from "@/pages/StatisticsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoginPage } from "@/pages/LoginPage"
import { useTheme } from "@/hooks/use-theme"
import { useQuickAddShortcut } from "@/hooks/use-shortcut"

// Top-right nav: all action buttons grouped together
function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"
  const isSettings = location.pathname === "/settings"

  const navTo = (path: string) => {
    navigate(path, { replace: !isHome })
  }

  const btnClass = "flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground shadow-md hover:shadow-lg transition-shadow border backdrop-blur-sm"

  return (
    <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 flex items-center gap-2">
      {/* Quick add (home only) */}
      {isHome && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-shadow"
          title="快速记录"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      )}

      {/* Page nav */}
      {!isHome && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navTo("/")}
          className={btnClass}
          title="首页"
        >
          <Home className="h-3.5 w-3.5" />
        </motion.button>
      )}
      {!isStats && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navTo("/statistics")}
          className={btnClass}
          title="数据统计"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </motion.button>
      )}
      {!isSettings && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navTo("/settings")}
          className={btnClass}
          title="设置"
        >
          <Settings className="h-3.5 w-3.5" />
        </motion.button>
      )}

      {/* Theme toggle — rightmost */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleTheme}
        className={btnClass}
        title={isDark ? "切换浅色模式" : "切换深色模式"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Sun className="h-3.5 w-3.5" />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Moon className="h-3.5 w-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}

// Global keyboard shortcut listener — dispatches event to open quick add
function GlobalShortcutListener() {
  useQuickAddShortcut(() => {
    window.dispatchEvent(new CustomEvent("openQuickAdd"))
  })
  return null
}

function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <TopNav />
      <GlobalShortcutListener />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check auth status: validate existing token or probe if auth is disabled
    const token = localStorage.getItem("token")
    // Either way, try an API call to verify access
    getSettings()
      .then(() => setAuthenticated(true))
      .catch(() => {
        if (token) localStorage.removeItem("token")
        setAuthenticated(false)
      })
  }, [])

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <TooltipProvider>
        <LoginPage onLogin={() => setAuthenticated(true)} />
        <Toaster />
      </TooltipProvider>
    )
  }

  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppLayout />
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  )
}
