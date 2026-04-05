import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { format, addDays, subDays, isToday } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Timeline } from "@/components/timeline"
import { getTimeline, getCategories, getDailyStats } from "@/api"
import type { LogEntry, Category, DurationItem } from "@/types"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { QuickAddDialog } from "@/components/QuickAddDialog"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import { showCategoryAssignToast } from "@/lib/category-toast"

export function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [durationItems, setDurationItems] = useState<DurationItem[]>([])
  const [timePointMode, setTimePointMode] = useState("end")
  const [loading, setLoading] = useState(false)

  const dateStr = format(currentDate, "yyyy-MM-dd")

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    try {
      const [data, stats] = await Promise.all([
        getTimeline(dateStr),
        getDailyStats(dateStr),
      ])
      setEntries(data || [])
      setDurationItems(stats?.items || [])
      if (stats?.time_point_mode) setTimePointMode(stats.time_point_mode)
    } catch {
      setEntries([])
      setDurationItems([])
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  // Listen for quick-add created events
  useEffect(() => {
    const handler = () => loadTimeline()
    window.addEventListener("logCreated", handler)
    return () => window.removeEventListener("logCreated", handler)
  }, [loadTimeline])

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => setCurrentDate((d) => subDays(d, 1))
  const goNext = () => setCurrentDate((d) => addDays(d, 1))

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; eventType: string }>({
    open: false,
    eventType: "",
  })

  // Listen for global shortcut event
  useEffect(() => {
    const handler = () => setQuickAddOpen(true)
    window.addEventListener("openQuickAdd", handler)
    return () => window.removeEventListener("openQuickAdd", handler)
  }, [])

  const displayDate = format(currentDate, "M月d日 EEE", { locale: zhCN })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      const isInputFocused = tag === "INPUT" || tag === "TEXTAREA"

      if (isInputFocused) return

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          goPrev()
          break
        case "ArrowRight":
          e.preventDefault()
          if (!isToday(currentDate)) goNext()
          break
        case "t":
          e.preventDefault()
          goToday()
          break
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [currentDate])

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-2xl mx-auto w-full px-4 overflow-hidden">
      {/* Date navigation — fixed at top, same height as other pages' titles */}
      <div className="shrink-0 pt-4 pb-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1"
        >
        <Button size="icon" variant="ghost" onClick={goPrev} className="h-7 w-7 shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent transition-colors text-sm">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium whitespace-nowrap">{displayDate}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(day) => {
                if (day) {
                  setCurrentDate(day)
                  setCalendarOpen(false)
                }
              }}
              locale={zhCN}
              disabled={{ after: new Date() }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

          {!isToday(currentDate) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={goToday}
              className="h-6 w-6 shrink-0 text-[10px] font-semibold text-primary"
              title="回到今天"
            >
              今
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={goNext}
            className="h-7 w-7 shrink-0"
            disabled={isToday(currentDate)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* Timeline — fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <Timeline
            entries={entries}
            onUpdate={loadTimeline}
            categories={categories}
            date={dateStr}
            isToday={isToday(currentDate)}
            durationItems={durationItems}
            timePointMode={timePointMode}
          />
        )}
      </div>

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={() => {
          window.dispatchEvent(new CustomEvent("logCreated"))
        }}
        onUncategorized={(eventType) => {
          showCategoryAssignToast(eventType, () => {
            setAssignDialog({ open: true, eventType })
          })
        }}
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
