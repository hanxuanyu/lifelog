import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { format, addDays, subDays, isToday } from "date-fns"
import { zhCN } from "date-fns/locale"
import { LogInput } from "@/components/LogInput"
import { Timeline } from "@/components/timeline"
import { getTimeline, getCategories, getDailyStats } from "@/api"
import type { LogEntry, Category, DurationItem } from "@/types"
import { Button } from "@/components/ui/button"

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

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  const goToday = () => setCurrentDate(new Date())
  const goPrev = () => setCurrentDate((d) => subDays(d, 1))
  const goNext = () => setCurrentDate((d) => addDays(d, 1))

  const displayDate = format(currentDate, "M月d日 EEEE", { locale: zhCN })

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-4 pb-20 sm:pb-4">
      {/* Date navigation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-2 mb-4"
      >
        <Button size="icon" variant="ghost" onClick={goPrev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button
          onClick={goToday}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayDate}</span>
          {!isToday(currentDate) && (
            <span className="text-[10px] text-primary font-medium ml-1">
              回今天
            </span>
          )}
        </button>

        <Button
          size="icon"
          variant="ghost"
          onClick={goNext}
          className="h-8 w-8"
          disabled={isToday(currentDate)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* Log input */}
      <div className="mb-6">
        <LogInput onLogCreated={loadTimeline} date={dateStr} />
      </div>

      {/* Timeline — fills remaining space */}
      <div className="flex-1 min-h-0">
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
    </div>
  )
}
