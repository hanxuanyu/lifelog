import { useState, useEffect, lazy, Suspense } from "react"
import { createBrowserRouter, RouterProvider, useLocation, Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { getSettings } from "@/api"
import { HomePage } from "@/pages/HomePage"
import { LoginPage } from "@/pages/LoginPage"
import { useNavigationStyle } from "@/hooks/use-navigation-style"
import { QuickAddDialog } from "@/components/QuickAddDialog"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import { showCategoryAssignToast } from "@/lib/category-toast"
import { isStandaloneDisplayMode } from "@/lib/navigation"
import { TopNav } from "@/components/navigation/TopNav"
import { MobileActionDock } from "@/components/navigation/MobileActionDock"
import { MobileTopActions } from "@/components/navigation/MobileTopActions"
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav"
import { GlobalShortcutListener } from "@/components/navigation/GlobalShortcutListener"
import { format } from "date-fns"

const StatisticsPage = lazy(() => import("@/pages/StatisticsPage").then((m) => ({ default: m.StatisticsPage })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })))

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
      if (Math.abs(delta) < 24) return

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
      {showAutoMobileNav && <MobileBottomNav collapsed={bottomNavCollapsed} />}
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
