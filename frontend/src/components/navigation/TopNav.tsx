import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Settings, Home, Plus, Sun, Moon, Search } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { navigateWithReplace } from "@/lib/navigation"

export function TopNav({ showOnMobile = false }: { showOnMobile?: boolean }) {
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
  const mobileQuickActionClass = "flex h-10 w-10 items-center justify-center rounded-full border bg-background/88 text-foreground shadow-lg backdrop-blur-md active:scale-95"

  return (
    <>
      <div
        className={`${showOnMobile ? "flex gap-1.5" : "hidden sm:flex gap-2"} fixed right-4 top-4 z-50 items-center sm:right-6 sm:top-5`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {isHome && !showOnMobile && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-shadow hover:shadow-lg sm:flex"
            title="快速记录"
            aria-label="快速记录"
          >
            <Plus className="h-4 w-4" />
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

        {!showOnMobile && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.225, type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.dispatchEvent(new CustomEvent("openGlobalSearch"))}
            className={btnClass}
            title="搜索"
            aria-label="搜索"
          >
            <Search className={iconClass} />
          </motion.button>
        )}

        {!showOnMobile && (
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
        )}
      </div>

      {showOnMobile && (
        <div
          className="sm:hidden fixed right-4 z-50 flex flex-col items-center gap-2.5 transition-[bottom] duration-300 ease-out"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.85rem + var(--mobile-toast-lift, 0px))" }}
        >
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 360, damping: 24 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            className={mobileQuickActionClass}
            title={isDark ? "切换浅色模式" : "切换深色模式"}
            aria-label={isDark ? "切换浅色模式" : "切换深色模式"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.div key="sun-mobile" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Sun className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div key="moon-mobile" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 360, damping: 24 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => window.dispatchEvent(new CustomEvent("openGlobalSearch"))}
            className={mobileQuickActionClass}
            title="搜索"
            aria-label="搜索"
          >
            <Search className="h-4 w-4" />
          </motion.button>

          {isHome && (
            <motion.button
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.16, type: "spring", stiffness: 360, damping: 24 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
              className="flex h-[3.125rem] w-[3.125rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
              title="快速记录"
              aria-label="快速记录"
            >
              <Plus className="h-5 w-5" />
            </motion.button>
          )}
        </div>
      )}
    </>
  )
}
