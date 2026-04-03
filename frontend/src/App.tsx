import React, { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { BarChart3, Settings } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { StatisticsPage } from "@/pages/StatisticsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoginPage } from "@/pages/LoginPage"

function FloatingNav() {
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-50 flex flex-col gap-2">
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/statistics")}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
        title="数据统计"
      >
        <BarChart3 className="h-4 w-4" />
      </motion.button>
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/settings")}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl transition-shadow border"
        title="设置"
      >
        <Settings className="h-4 w-4" />
      </motion.button>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
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
