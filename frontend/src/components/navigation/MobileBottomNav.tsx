import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, Home, Plus } from "lucide-react"
import { navigateWithReplace } from "@/lib/navigation"

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

export function MobileBottomNav({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === "/"
  const isStats = location.pathname === "/statistics"

  const navWidth = collapsed ? "5.25rem" : "10.5rem"
  const buttonClass = (active: boolean) =>
    `flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors duration-150 ${
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`

  const labelClass = (active: boolean) =>
    `overflow-hidden text-[10px] leading-none font-medium transition-[max-height,opacity,transform] duration-160 ${
      active ? "text-primary" : ""
    } ${collapsed ? "max-h-0 -translate-y-0.5 opacity-0" : "max-h-3 translate-y-0 opacity-100"}`

  return (
    <div className="pointer-events-none sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.85rem)]">
      <div className="pointer-events-auto relative mx-auto flex items-end justify-center" style={{ maxWidth: "calc(100vw - 2rem)" }}>

        <motion.nav
          className="relative isolate overflow-hidden rounded-full border shadow-lg"
          animate={{
            width: navWidth,
            y: collapsed ? 14 : 0,
            opacity: collapsed ? 0.88 : 1,
            padding: collapsed ? "0.2rem 0.25rem" : "0.25rem 0.375rem",
          }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            transformOrigin: "center bottom",
            backgroundColor: collapsed ? "color-mix(in srgb, var(--background) 58%, transparent)" : "color-mix(in srgb, var(--background) 88%, transparent)",
            backdropFilter: collapsed ? "blur(10px) saturate(118%)" : "blur(20px) saturate(145%)",
            borderColor: collapsed ? "color-mix(in srgb, white 10%, var(--border) 42%)" : "color-mix(in srgb, white 18%, var(--border) 55%)",
            boxShadow: collapsed
              ? "0 8px 18px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.12)"
              : "0 12px 28px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          <MobileBottomNavGlass collapsed={collapsed} />

          <div className={`relative z-10 flex items-center justify-evenly ${collapsed ? "gap-0.5" : "gap-1"}`}>
            <button
              type="button"
              onClick={() => !isHome && navigateWithReplace(navigate, isHome, "/")}
              className={buttonClass(isHome)}
              aria-current={isHome ? "page" : undefined}
            >
              <Home className={`shrink-0 transition-transform duration-150 ${isHome ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4"}`} />
              <span className={labelClass(isHome)}>首页</span>
            </button>

            <button
              type="button"
              onClick={() => !isStats && navigateWithReplace(navigate, isHome, "/statistics")}
              className={buttonClass(isStats)}
              aria-current={isStats ? "page" : undefined}
            >
              <BarChart3 className={`shrink-0 transition-transform duration-150 ${isStats ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4"}`} />
              <span className={labelClass(isStats)}>统计</span>
            </button>
          </div>
        </motion.nav>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => window.dispatchEvent(new CustomEvent("openQuickAdd"))}
            className="pointer-events-auto fixed right-4 z-50 flex h-[3.125rem] w-[3.125rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.85rem)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            }}
            title="快速记录"
            aria-label="快速记录"
          >
            <Plus className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
