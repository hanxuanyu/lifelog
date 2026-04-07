import React, { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "framer-motion"

interface TimePickerProps {
  value: string // "HH:mm"
  onChange: (value: string) => void
  compact?: boolean
}

function WheelColumn({
  items,
  selected,
  onSelect,
  label,
  compact = false,
}: {
  items: string[]
  selected: number
  onSelect: (index: number) => void
  label: string
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemHeight = compact ? 36 : 40
  const containerHeight = compact ? 108 : 200
  const gradientHeight = compact ? 36 : 80
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (containerRef.current && !isScrollingRef.current) {
      containerRef.current.scrollTop = selected * itemHeight
    }
  }, [selected])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    isScrollingRef.current = true
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return
      const scrollTop = containerRef.current.scrollTop
      const index = Math.round(scrollTop / itemHeight)
      const clamped = Math.max(0, Math.min(items.length - 1, index))
      containerRef.current.scrollTo({ top: clamped * itemHeight, behavior: "smooth" })
      onSelect(clamped)
      isScrollingRef.current = false
    }, 80)
  }, [items.length, onSelect])

  return (
    <div className="flex flex-col items-center">
      {!compact && <span className="text-xs text-muted-foreground mb-1">{label}</span>}
      <div className="relative overflow-hidden" style={{ height: containerHeight, width: compact ? 44 : 64 }}>
        {/* Selection highlight */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-accent rounded-lg pointer-events-none z-0 border" style={{ height: itemHeight }} />
        {/* Gradient masks */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" style={{ height: gradientHeight }} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" style={{ height: gradientHeight }} />
        {/* Scrollable area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative z-10 h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
          style={{
            paddingTop: containerHeight / 2 - itemHeight / 2,
            paddingBottom: containerHeight / 2 - itemHeight / 2,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {items.map((item, i) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                onSelect(i)
                containerRef.current?.scrollTo({ top: i * itemHeight, behavior: "smooth" })
              }}
              className={`snap-center flex items-center justify-center w-full transition-all duration-150 ${
                i === selected
                  ? `text-foreground font-semibold ${compact ? "text-base" : "text-lg"}`
                  : `text-muted-foreground ${compact ? "text-sm" : "text-base"}`
              }`}
              style={{ height: itemHeight }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

export function MobileTimePicker({ value, onChange, compact = false }: TimePickerProps) {
  const [h, m] = value.split(":").map(Number)
  const [hour, setHour] = useState(isNaN(h) ? new Date().getHours() : h)
  const [minute, setMinute] = useState(isNaN(m) ? new Date().getMinutes() : m)

  useEffect(() => {
    const [ph, pm] = value.split(":").map(Number)
    if (!isNaN(ph)) setHour(ph)
    if (!isNaN(pm)) setMinute(pm)
  }, [value])

  useEffect(() => {
    const newVal = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    if (newVal !== value) {
      onChange(newVal)
    }
  }, [hour, minute])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center justify-center ${compact ? "gap-0.5 py-1" : "gap-2 py-2"}`}
    >
      <WheelColumn items={HOURS} selected={hour} onSelect={setHour} label="时" compact={compact} />
      <span className={`${compact ? "text-lg" : "text-2xl"} font-bold text-muted-foreground ${compact ? "mt-0" : "mt-5"}`}>:</span>
      <WheelColumn items={MINUTES} selected={minute} onSelect={setMinute} label="分" compact={compact} />
    </motion.div>
  )
}
