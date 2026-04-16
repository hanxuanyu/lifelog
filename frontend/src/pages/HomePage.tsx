import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { format, addDays, subDays, isToday, isValid, parseISO } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useLocation } from "react-router-dom"
import { Timeline } from "@/components/timeline"
import { getTimeline, getCategories, getDailyStats } from "@/api"
import type { LogEntry, Category, DurationItem, CrossDayHint } from "@/types"
import { formatTime } from "@/components/timeline/shared"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function HomePage() {
  const location = useLocation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [durationItems, setDurationItems] = useState<DurationItem[]>([])
  const [crossDayHints, setCrossDayHints] = useState<CrossDayHint[]>([])
  const [prevDayLastTime, setPrevDayLastTime] = useState<string | undefined>(undefined)
  const [timePointMode, setTimePointMode] = useState("end")
  const [loading, setLoading] = useState(false)
  const [pendingHighlightEntryId, setPendingHighlightEntryId] = useState<number | null>(null)
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null)

  const dateStr = format(currentDate, "yyyy-MM-dd")

  useEffect(() => {
    const state = location.state as { focusDate?: string; focusEntryId?: number } | null
    if (!state?.focusDate && typeof state?.focusEntryId !== "number") return

    if (state?.focusDate) {
      const parsedDate = parseISO(state.focusDate)
      if (isValid(parsedDate)) setCurrentDate(parsedDate)
    }

    if (typeof state?.focusEntryId === "number") {
      setPendingHighlightEntryId(state.focusEntryId)
    }
  }, [location.key, location.state])

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    try {
      const [data, stats] = await Promise.all([
        getTimeline(dateStr),
        getDailyStats(dateStr),
      ])
      setEntries(data || [])
      setDurationItems(stats?.items || [])
      setCrossDayHints(stats?.cross_day_hints || [])
      setPrevDayLastTime(stats?.prev_day_last_time)
      if (stats?.time_point_mode) setTimePointMode(stats.time_point_mode)
    } catch {
      setEntries([])
      setDurationItems([])
      setCrossDayHints([])
      setPrevDayLastTime(undefined)
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

  useEffect(() => {
    if (loading || pendingHighlightEntryId === null) return
    if (!entries.some((entry) => entry.id === pendingHighlightEntryId)) return

    setHighlightedEntryId(pendingHighlightEntryId)
    setPendingHighlightEntryId(null)

    const timer = window.setTimeout(() => {
      setHighlightedEntryId((current) => current === pendingHighlightEntryId ? null : current)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [entries, loading, pendingHighlightEntryId])

  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => setCurrentDate((d) => subDays(d, 1))
  const goNext = () => setCurrentDate((d) => addDays(d, 1))

  const [calendarOpen, setCalendarOpen] = useState(false)

  const displayDate = format(currentDate, "M月d日 EEE", { locale: zhCN })

  // Keyboard shortcuts — listen for global dialog state to block shortcuts
  const [dialogOpen, setDialogOpen] = useState(false)
  useEffect(() => {
    const handler = (e: Event) => setDialogOpen((e as CustomEvent).detail)
    window.addEventListener("timelineEditing", handler)
    return () => window.removeEventListener("timelineEditing", handler)
  }, [])

  // Dispatch date state for MobileDateNav
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("dateNavState", { detail: { isToday: isToday(currentDate) } }))
  }, [currentDate])

  // Listen for MobileDateNav prev/next events
  useEffect(() => {
    const onPrev = () => setCurrentDate((d) => subDays(d, 1))
    const onNext = () => setCurrentDate((d) => { if (!isToday(d)) return addDays(d, 1); return d })
    window.addEventListener("dateNavPrev", onPrev)
    window.addEventListener("dateNavNext", onNext)
    return () => {
      window.removeEventListener("dateNavPrev", onPrev)
      window.removeEventListener("dateNavNext", onNext)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen) return

      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

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
  }, [currentDate, dialogOpen])

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
            crossDayHints={crossDayHints}
            prevDayLastTime={prevDayLastTime}
            timePointMode={timePointMode}
            externalHighlightedEntryId={highlightedEntryId}
            onEditRequest={(entry) => {
              window.dispatchEvent(new CustomEvent("openQuickAddEdit", {
                detail: {
                  entry: {
                    id: entry.id,
                    time: formatTime(entry.log_time),
                    event: entry.event_type,
                    detail: entry.detail,
                  },
                  date: dateStr,
                },
              }))
            }}
            onRailCreate={(time) => {
              window.dispatchEvent(new CustomEvent("openQuickAddRail", {
                detail: { time, date: dateStr },
              }))
            }}
          />
        )}
      </div>
    </div>
  )
}
