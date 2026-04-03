import React, { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "framer-motion"

interface TimePickerProps {
  value: string // "HH:mm"
  onChange: (value: string) => void
}

function WheelColumn({
  items,
  selected,
  onSelect,
  label,
}: {
  items: string[]
  selected: number
  onSelect: (index: number) => void
  label: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemHeight = 40
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
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="relative h-[200px] w-[64px] overflow-hidden">
        {/* Selection highlight — behind content */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[40px] bg-accent rounded-lg pointer-events-none z-0 border" />
        {/* Gradient masks — above content */}
        <div className="absolute inset-x-0 top-0 h-[80px] bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[80px] bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
        {/* Scrollable area — between highlight and masks */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative z-10 h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
          style={{
            paddingTop: 80,
            paddingBottom: 80,
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
                  ? "text-foreground font-semibold text-lg"
                  : "text-muted-foreground text-base"
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

export function MobileTimePicker({ value, onChange }: TimePickerProps) {
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
      className="flex items-center justify-center gap-2 py-2"
    >
      <WheelColumn items={HOURS} selected={hour} onSelect={setHour} label="时" />
      <span className="text-2xl font-bold text-muted-foreground mt-5">:</span>
      <WheelColumn items={MINUTES} selected={minute} onSelect={setMinute} label="分" />
    </motion.div>
  )
}
