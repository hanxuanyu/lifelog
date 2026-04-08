import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@ncdai/react-wheel-picker"
import "@ncdai/react-wheel-picker/style.css"

interface TimePickerProps {
  value: string // "HH:mm"
  onChange: (value: string) => void
  compact?: boolean
}

const HOUR_OPTIONS: WheelPickerOption[] = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, "0")
  return { label: v, value: v }
})

const MINUTE_OPTIONS: WheelPickerOption[] = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, "0")
  return { label: v, value: v }
})

const pickerClassNames = {
  optionItem: "!text-muted-foreground !text-sm font-mono",
  highlightWrapper: "!bg-accent !rounded-lg !border !border-border",
  highlightItem: "!text-foreground !font-semibold !text-base font-mono",
}

const compactPickerClassNames = {
  optionItem: "!text-muted-foreground !text-sm font-mono",
  highlightWrapper: "!bg-accent !rounded-md !border !border-border",
  highlightItem: "!text-foreground !font-semibold !text-base font-mono",
}

export function MobileTimePicker({ value, onChange, compact = false }: TimePickerProps) {
  const [h, m] = value.split(":")
  const [hour, setHour] = useState(h || "00")
  const [minute, setMinute] = useState(m || "00")

  useEffect(() => {
    const [ph, pm] = value.split(":")
    if (ph && ph !== hour) setHour(ph)
    if (pm && pm !== minute) setMinute(pm)
  }, [value])

  const prevRef = useRef(value)
  useEffect(() => {
    const newVal = `${hour}:${minute}`
    if (newVal !== prevRef.current) {
      prevRef.current = newVal
      onChange(newVal)
    }
  }, [hour, minute])

  const itemHeight = compact ? 32 : 36
  const visibleCount = compact ? 8 : 20
  const cls = compact ? compactPickerClassNames : pickerClassNames

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center justify-center ${compact ? "gap-0.5" : "gap-1 py-2"}`}
    >
      <div className={compact ? "w-[44px]" : "w-[64px]"}>
        <WheelPickerWrapper>
          <WheelPicker
            options={HOUR_OPTIONS}
            value={hour}
            onValueChange={setHour}
            infinite
            visibleCount={visibleCount}
            optionItemHeight={itemHeight}
            classNames={cls}
          />
        </WheelPickerWrapper>
      </div>
      <span className={`${compact ? "text-base" : "text-2xl"} font-bold text-muted-foreground`}>:</span>
      <div className={compact ? "w-[44px]" : "w-[64px]"}>
        <WheelPickerWrapper>
          <WheelPicker
            options={MINUTE_OPTIONS}
            value={minute}
            onValueChange={setMinute}
            infinite
            visibleCount={visibleCount}
            optionItemHeight={itemHeight}
            classNames={cls}
          />
        </WheelPickerWrapper>
      </div>
    </motion.div>
  )
}
