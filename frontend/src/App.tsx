import React, { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Plus, Home, Sun, Moon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { StatisticsPage } from "@/pages/StatisticsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoginPage } from "@/pages/LoginPage"
import { QuickAddDialog } from "@/components/QuickAddDialog"
import { useTheme } from "@/hooks/use-theme"

function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === "/"

  if (!isHome) return null

  return (
    <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 flex items-center gap-2">
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/statistics", { replace: !isHome })}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground shadow-md hover:shadow-lg transition-shadow border backdrop-blur-sm"
        title="数据统计"
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </motion.button>
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/settings", { replace: !isHome })}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground shadow-md hover:shadow-lg transition-shadow border backdrop-blur-sm"
        title="设置"
      >
        <Settings className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  )
}

function FloatingNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const isHome = location.pathname === "/"

  return (
    <>
      <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-50 flex flex-col gap-2">
        {/* Theme toggle */}
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl transition-shadow border"
          title={isDark ? "切换浅色模式" : "切换深色模式"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Sun className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Moon className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Primary action button: + on home, Home icon on other pages */}
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (isHome) {
              setQuickAddOpen(true)
            } else {
              navigate("/", { replace: true })
            }
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
          title={isHome ? "快速记录" : "返回首页"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isHome ? (
              <motion.div key="plus" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Plus className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div key="home" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Home className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => {
          window.dispatchEvent(new CustomEvent("logCreated"))
        }}
      />
    </>
  )
}

function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <TopNav />
      <FloatingNav />
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
