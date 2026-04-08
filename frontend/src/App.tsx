import React, { useState, useEffect, lazy, Suspense } from "react"
import { createBrowserRouter, RouterProvider, useNavigate, useLocation, useBlocker, Outlet } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Home, Plus, Sun, Moon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { useTheme } from "@/hooks/use-theme"
import { useQuickAddShortcut } from "@/hooks/use-shortcut"
import { QuickAddDialog } from "@/components/QuickAddDialog"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import { showCategoryAssignToast } from "@/lib/category-toast"
import { format } from "date-fns"

const StatisticsPage = lazy(() => import("@/pages/StatisticsPage").then(m => ({ default: m.StatisticsPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })))

// Top-right nav: all action buttons grouped together
function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"
  const isSettings = location.pathname === "/settings"

  const navTo = (path: string) => {
    if (path === "/") {
      navigate(path, { replace: true })
    } else {
      navigate(path, { replace: !isHome })
    }
  }

  const btnClass = "flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground shadow-md hover:shadow-lg transition-shadow border backdrop-blur-sm"

  return (
    <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 flex items-center gap-2" style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
      {/* Quick add (home only, hidden on mobile — FAB replaces it) */}
      {isHome && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-shadow"
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
  const location = useLocation()
  const isHome = location.pathname === "/"
  const [timelineEditing, setTimelineEditing] = useState(false)

  // Quick add dialog state (global, works on all pages)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<{
    id: number; time: string; event: string; detail: string
  } | null>(null)
  const [quickAddInitialTime, setQuickAddInitialTime] = useState<string | null>(null)
  const [quickAddDate, setQuickAddDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; eventType: string }>({
    open: false, eventType: "",
  })

  // Listen for openQuickAdd (from shortcut or FAB/button)
  useEffect(() => {
    const handler = () => {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      setQuickAddDate(format(now, "yyyy-MM-dd"))
      setQuickAddInitialTime(time)
      setEditTarget(null)
      setQuickAddOpen(true)
    }
    window.addEventListener("openQuickAdd", handler)
    return () => window.removeEventListener("openQuickAdd", handler)
  }, [])

  // Listen for edit request from HomePage timeline
  useEffect(() => {
    const handler = (e: Event) => {
      const { entry, date } = (e as CustomEvent).detail
      setEditTarget(entry)
      setQuickAddDate(date)
      setQuickAddInitialTime(null)
      setQuickAddOpen(true)
    }
    window.addEventListener("openQuickAddEdit", handler)
    return () => window.removeEventListener("openQuickAddEdit", handler)
  }, [])

  // Listen for rail create from HomePage timeline
  useEffect(() => {
    const handler = (e: Event) => {
      const { time, date } = (e as CustomEvent).detail
      setQuickAddInitialTime(time)
      setQuickAddDate(date)
      setEditTarget(null)
      setQuickAddOpen(true)
    }
    window.addEventListener("openQuickAddRail", handler)
    return () => window.removeEventListener("openQuickAddRail", handler)
  }, [])

  // Notify FAB to hide when dialog is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("timelineEditing", { detail: quickAddOpen }))
  }, [quickAddOpen])

  // Listen for timeline editing state changes
  useEffect(() => {
    const handler = (e: Event) => {
      setTimelineEditing((e as CustomEvent).detail)
    }
    window.addEventListener("timelineEditing", handler)
    return () => window.removeEventListener("timelineEditing", handler)
  }, [])

  // Reset when leaving home
  useEffect(() => {
    if (!isHome) setTimelineEditing(false)
  }, [isHome])

  // Lock body scroll on HomePage (contained layout);
  // allow it on other pages so iOS Safari address-bar reacts to scroll.
  useEffect(() => {
    document.body.classList.toggle("no-scroll", isHome)
    if (!isHome) window.scrollTo(0, 0)
    return () => document.body.classList.remove("no-scroll")
  }, [isHome])

  // Block browser back / swipe-back on home page to prevent exiting PWA.
  // useBlocker works within React Router's own history management, avoiding
  // conflicts that raw pushState/popstate listeners would cause.
  const blocker = useBlocker(({ historyAction }) => {
    return isHome && historyAction === "POP"
  })

  // When the blocker fires, silently reset it so the app stays on home.
  useEffect(() => {
    if (blocker.state === "blocked") {
      blocker.reset()
    }
  }, [blocker])

  return (
    <div className={`flex flex-col ${isHome ? "app-view-height overflow-hidden" : "app-min-view-height"}`}>
      <TopNav />
      <GlobalShortcutListener />
      <main className={isHome ? "flex-1 min-h-0 overflow-hidden flex flex-col" : "flex-1"}>
        <Outlet />
      </main>

      {/* Mobile FAB — quick add (home only, hidden during editing) */}
      {isHome && !timelineEditing && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
          className="sm:hidden fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:shadow-xl"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
          title="快速记录"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      )}

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false)
          setEditTarget(null)
          setQuickAddInitialTime(null)
        }}
        onCreated={() => {
          window.dispatchEvent(new CustomEvent("logCreated"))
        }}
        onUncategorized={(eventType) => {
          showCategoryAssignToast(eventType, () => {
            setAssignDialog({ open: true, eventType })
          })
        }}
        date={quickAddDate}
        editEntry={editTarget}
        initialTime={quickAddInitialTime}
      />

      <CategoryAssignDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        eventType={assignDialog.eventType}
        onAssigned={() => {
          window.dispatchEvent(new CustomEvent("logCreated"))
        }}
      />
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/statistics", element: <Suspense fallback={null}><StatisticsPage /></Suspense> },
      { path: "/settings", element: <Suspense fallback={null}><SettingsPage /></Suspense> },
    ],
  },
])

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
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  )
}
