import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

function DateNavGlass() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10%] top-[7%] h-[44%] rounded-full opacity-90"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.05) 100%)",
          filter: "blur(10px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[8%] top-[18%] h-[58%] w-[30%] rounded-full opacity-80"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.02) 52%, rgba(255,255,255,0) 76%)",
          filter: "blur(8px)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10%] top-[1px] h-px"
        style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.52) 50%, rgba(255,255,255,0) 100%)" }}
      />
    </>
  )
}

export function MobileDateNav({ collapsed, mode, hidden }: { collapsed: boolean; mode: "auto" | "floating"; hidden: boolean }) {
  const [isTodayState, setIsTodayState] = useState(true)

  useEffect(() => {
    const handler = (e: Event) => {
      setIsTodayState((e as CustomEvent<{ isToday: boolean }>).detail.isToday)
    }
    window.addEventListener("dateNavState", handler)
    return () => window.removeEventListener("dateNavState", handler)
  }, [])

  const handlePrev = () => window.dispatchEvent(new CustomEvent("dateNavPrev"))
  const handleNext = () => {
    if (!isTodayState) window.dispatchEvent(new CustomEvent("dateNavNext"))
  }

  const pill = (
    <motion.div
      className="liquid-glass-nav relative isolate overflow-hidden rounded-full border flex items-center will-change-[opacity,transform]"
      style={{
        ["--liquid-glass-bg" as string]: "color-mix(in srgb, var(--background) 10%, transparent)",
        ["--liquid-glass-border" as string]: "color-mix(in srgb, white 20%, var(--border) 34%)",
        ["--liquid-glass-shadow" as string]: "0 16px 34px rgba(15,23,42,0.12)",
        ["--liquid-glass-blur" as string]: "22px",
      }}
    >
      <DateNavGlass />
      <button
        type="button"
        onClick={handlePrev}
        className="relative z-10 flex h-10 w-10 items-center justify-center active:scale-95 transition-transform"
        aria-label="前一天"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>
      <div className="relative z-10 h-4 w-px bg-border/40" />
      <button
        type="button"
        onClick={handleNext}
        disabled={isTodayState}
        className="relative z-10 flex h-10 w-10 items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
        aria-label="后一天"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </motion.div>
  )

  const bottomStyle = {
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.85rem + 0.25rem + var(--mobile-toast-lift, 0px))",
  }

  const visible = !hidden && (mode === "floating" || !collapsed)

  const positionClass = mode === "floating"
    ? "sm:hidden fixed left-1/2 -translate-x-1/2 z-50 overflow-hidden transition-[bottom] duration-300 ease-out"
    : "sm:hidden fixed left-4 z-50 overflow-hidden transition-[bottom] duration-300 ease-out"

  return (
    <div className={positionClass} style={bottomStyle}>
      <motion.div
        animate={visible ? { y: 0, pointerEvents: "auto" as const } : { y: "calc(100% + 1.5rem)", pointerEvents: "none" as const }}
        initial={false}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {pill}
      </motion.div>
    </div>
  )
}
