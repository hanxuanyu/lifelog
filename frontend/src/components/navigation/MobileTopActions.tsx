import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Settings, Sun, Moon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { navigateWithReplace } from "@/lib/navigation"

export function MobileTopActions() {
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
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 300, damping: 20 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.dispatchEvent(new CustomEvent("openGlobalSearch"))}
        className="flex h-9 w-9 items-center justify-center rounded-full border bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm"
        title="搜索"
        aria-label="搜索"
      >
        <Search className="h-[15px] w-[15px]" />
      </motion.button>

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
