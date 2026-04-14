import React, { useState, useEffect, lazy, Suspense } from "react"
import { createBrowserRouter, RouterProvider, useNavigate, useLocation, Outlet } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Home, Plus, Sun, Moon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { useTheme } from "@/hooks/use-theme"
import { useNavigationStyle } from "@/hooks/use-navigation-style"
import { useQuickAddShortcut } from "@/hooks/use-shortcut"
import { QuickAddDialog } from "@/components/QuickAddDialog"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import { showCategoryAssignToast } from "@/lib/category-toast"
import { format } from "date-fns"

const StatisticsPage = lazy(() => import("@/pages/StatisticsPage").then((m) => ({ default: m.StatisticsPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })))

function navigateWithReplace(navigate: ReturnType<typeof useNavigate>, isHome: boolean, path: string) {
  if (path === "/") {
    navigate(path, { replace: true })
    return
  }

  navigate(path, { replace: !isHome })
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone
}

function TopNav({ showOnMobile = false }: { showOnMobile?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"
  const isSettings = location.pathname === "/settings"

  const navTo = (path: string) => navigateWithReplace(navigate, isHome, path)
  const btnClass = `flex items-center justify-center rounded-full border bg-secondary/80 text-secondary-foreground shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg ${
    showOnMobile ? "h-9 w-9 sm:h-8 sm:w-8" : "h-8 w-8"
  }`
  const iconClass = showOnMobile ? "h-[15px] w-[15px]" : "h-3.5 w-3.5"

  return (
    <div
      className={`${showOnMobile ? "flex gap-1.5" : "hidden sm:flex gap-2"} fixed right-4 top-4 z-50 items-center sm:right-6 sm:top-5`}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      {isHome && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
          className={`${showOnMobile ? "flex h-9 w-9 sm:h-8 sm:w-8" : "hidden sm:flex h-8 w-8"} items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-shadow hover:shadow-lg`}
          title="快速记录"
          aria-label="快速记录"
        >
          <Plus className={showOnMobile ? "h-4 w-4 sm:h-4 sm:w-4" : "h-4 w-4"} />
        </motion.button>
      )}

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
          aria-label="首页"
        >
          <Home className={iconClass} />
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
          aria-label="数据统计"
        >
          <BarChart3 className={iconClass} />
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
          aria-label="设置"
        >
          <Settings className={iconClass} />
        </motion.button>
      )}

      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleTheme}
        className={btnClass}
        title={isDark ? "切换浅色模式" : "切换深色模式"}
        aria-label={isDark ? "切换浅色模式" : "切换深色模式"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Sun className={iconClass} />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Moon className={iconClass} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}

function MobileActionDock({ hidden }: { hidden: boolean }) {
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
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
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
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg active:shadow-xl ${
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

function MobileTopActions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const isHome = location.pathname === "/"
  const isSettings = location.pathname === "/settings"

  return (
    <div
      className="sm:hidden fixed right-4 top-4 z-50 flex items-center gap-1.5"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      {!isSettings && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateWithReplace(navigate, isHome, "/settings")}
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm"
          title="设置"
          aria-label="设置"
        >
          <Settings className="h-[15px] w-[15px]" />
        </motion.button>
      )}

      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full border bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm"
        title={isDark ? "切换浅色模式" : "切换深色模式"}
        aria-label={isDark ? "切换浅色模式" : "切换深色模式"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Sun className="h-[15px] w-[15px]" />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Moon className="h-[15px] w-[15px]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}

function MobileBottomNavGlass({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-full opacity-80"
        style={{
          background: collapsed
            ? "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.05) 100%)",
          filter: "blur(8px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-6 top-2 h-12 w-[4.5rem] rounded-full opacity-70"
        style={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 72%)",
          filter: "blur(6px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-1 h-px"
        style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)" }}
      />
    </>
  )
}

function MobileBottomNav({ fabHidden = false, collapsed = false }: { fabHidden?: boolean; collapsed?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"

  const navWidth = collapsed ? "12rem" : "18rem"
  const buttonClass = (active: boolean) =>
    `flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-1.5 transition-colors duration-150 ${
      active ? "border border-white/15 bg-white/16 text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/8 hover:text-foreground"
    }`

  const labelClass = `overflow-hidden text-[10px] leading-none transition-[max-height,opacity,transform] duration-160 ${collapsed ? "max-h-0 -translate-y-0.5 opacity-0" : "max-h-3 translate-y-0 opacity-100"}`

  return (
    <div className="pointer-events-none sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.85rem)]">
      <div className="pointer-events-auto relative mx-auto" style={{ maxWidth: "calc(100vw - 2rem)" }}>
        {!fabHidden && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
            <motion.button
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: collapsed ? 4 : 0 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
              className="pointer-events-auto -mt-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/96 text-primary-foreground"
              style={{
                boxShadow: collapsed
                  ? "0 10px 24px rgba(0,0,0,0.18)"
                  : "0 14px 32px rgba(0,0,0,0.22)",
                backdropFilter: collapsed ? "blur(10px)" : "blur(6px)",
              }}
              title="快速记录"
              aria-label="快速记录"
            >
              <Plus className="h-5 w-5" />
            </motion.button>
          </div>
        )}

        <motion.nav
          className="relative isolate mx-auto overflow-hidden rounded-[1.5rem] border shadow-xl"
          animate={{
            width: navWidth,
            y: collapsed ? 10 : 0,
            opacity: collapsed ? 0.92 : 1,
            padding: collapsed ? "0.25rem" : "0.375rem",
          }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            maxWidth: "calc(100vw - 2rem)",
            transformOrigin: "center bottom",
            backgroundColor: collapsed ? "color-mix(in srgb, var(--background) 72%, transparent)" : "color-mix(in srgb, var(--background) 80%, transparent)",
            backdropFilter: collapsed ? "blur(24px) saturate(155%)" : "blur(20px) saturate(145%)",
            borderColor: collapsed ? "color-mix(in srgb, white 16%, var(--border) 54%)" : "color-mix(in srgb, white 22%, var(--border) 62%)",
            boxShadow: collapsed
              ? "0 12px 28px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255,255,255,0.2)"
              : "0 18px 36px rgba(15, 23, 42, 0.16), inset 0 1px 0 rgba(255,255,255,0.24)",
          }}
        >
          <MobileBottomNavGlass collapsed={collapsed} />

          <div className="relative z-10 grid grid-cols-[1fr_2.75rem_1fr] items-center gap-1.25">
            <button
              type="button"
              onClick={() => !isHome && navigateWithReplace(navigate, isHome, "/")}
              className={buttonClass(isHome)}
              aria-current={isHome ? "page" : undefined}
            >
              <Home className="h-4 w-4 shrink-0" />
              <span className={labelClass}>首页</span>
            </button>

            <div className="h-10 w-11" aria-hidden="true" />

            <button
              type="button"
              onClick={() => !isStats && navigateWithReplace(navigate, isHome, "/statistics")}
              className={buttonClass(isStats)}
              aria-current={isStats ? "page" : undefined}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className={labelClass}>统计</span>
            </button>
          </div>
        </motion.nav>
      </div>
    </div>
  )
}

function GlobalShortcutListener() {
  useQuickAddShortcut(() => {
    window.dispatchEvent(new CustomEvent("openQuickAdd"))
  })
  return null
}

function AppLayout() {
  const location = useLocation()
  const isHome = location.pathname === "/"
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplayMode())
  const [timelineEditing, setTimelineEditing] = useState(false)
  const [bottomNavCollapsed, setBottomNavCollapsed] = useState(false)
  const { isAutoNavigation, isTopNavigation, isFloatingNavigation } = useNavigationStyle()

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<{
    id: number
    time: string
    event: string
    detail: string
  } | null>(null)
  const [quickAddInitialTime, setQuickAddInitialTime] = useState<string | null>(null)
  const [quickAddDate, setQuickAddDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; eventType: string }>({
    open: false,
    eventType: "",
  })

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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("timelineEditing", { detail: quickAddOpen }))
  }, [quickAddOpen])

  useEffect(() => {
    const handler = (e: Event) => {
      setTimelineEditing((e as CustomEvent).detail)
    }

    window.addEventListener("timelineEditing", handler)
    return () => window.removeEventListener("timelineEditing", handler)
  }, [])

  useEffect(() => {
    if (!isHome) setTimelineEditing(false)
  }, [isHome])

  useEffect(() => {
    document.body.classList.toggle("no-scroll", isHome)
    if (!isHome) window.scrollTo(0, 0)
    return () => document.body.classList.remove("no-scroll")
  }, [isHome])

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia("(display-mode: standalone)")
    const updateStandalone = () => setIsStandalone(isStandaloneDisplayMode())

    updateStandalone()
    media.addEventListener?.("change", updateStandalone)

    return () => {
      media.removeEventListener?.("change", updateStandalone)
    }
  }, [])

  useEffect(() => {
    if (!isStandalone || !isHome || typeof window === "undefined") return

    const state = window.history.state as { lifelogHomeGuard?: boolean } | null
    if (!state?.lifelogHomeGuard) {
      window.history.pushState({ ...(state || {}), lifelogHomeGuard: true }, "", window.location.href)
    }

    const handlePopState = () => {
      window.history.pushState({ ...(window.history.state || {}), lifelogHomeGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isStandalone, isHome])

  const showAutoMobileNav = isAutoNavigation
  const showTopNavOnMobile = isTopNavigation
  const showFloatingDock = isFloatingNavigation
  const mobileFabHidden = quickAddOpen || (isHome && timelineEditing)

  useEffect(() => {
    setBottomNavCollapsed(false)
  }, [location.pathname, quickAddOpen])

  useEffect(() => {
    if (!showAutoMobileNav || typeof window === "undefined") return

    const positions = new WeakMap<object, number>()

    const getSource = (target: EventTarget | null) => {
      if (target instanceof HTMLElement) return target
      return window
    }

    const getScrollTop = (source: HTMLElement | Window) => {
      if (source === window) {
        return window.scrollY || document.documentElement.scrollTop || 0
      }
      return (source as HTMLElement).scrollTop
    }

    const onScroll = (event: Event) => {
      if (quickAddOpen) return

      const source = getSource(event.target)
      const nextTop = getScrollTop(source)
      const prevTop = positions.get(source) ?? nextTop
      positions.set(source, nextTop)

      const delta = nextTop - prevTop
      if (Math.abs(delta) < 10) return

      if (nextTop <= 8) {
        setBottomNavCollapsed(false)
        return
      }

      setBottomNavCollapsed(delta > 0)
    }

    window.addEventListener("scroll", onScroll, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", onScroll, true)
  }, [showAutoMobileNav, quickAddOpen])

  return (
    <div className={`flex flex-col ${isHome ? "app-view-height overflow-hidden" : "app-min-view-height"}`}>
      <TopNav showOnMobile={showTopNavOnMobile} />
      {showAutoMobileNav && <MobileTopActions />}
      <MobileActionDock hidden={!showFloatingDock || mobileFabHidden} />
      {showAutoMobileNav && <MobileBottomNav fabHidden={mobileFabHidden} collapsed={bottomNavCollapsed} />}
      <GlobalShortcutListener />
      <main className={`${isHome ? "flex-1 min-h-0 overflow-hidden flex flex-col" : "flex-1"} ${showAutoMobileNav && !isHome ? "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-0" : ""}`}>
        <Outlet />
      </main>

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
    const token = localStorage.getItem("token")
    getSettings()
      .then(() => setAuthenticated(true))
      .catch(() => {
        if (token) localStorage.removeItem("token")
        setAuthenticated(false)
      })
  }, [])

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
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
