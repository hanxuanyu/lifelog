import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EventForm, type SuggestionTag } from "@/components/EventForm"
import { createLog, updateLog, getCategories, getEventTypes, getTimeline, getSettings } from "@/api"
import { formatDuration } from "@/components/timeline/shared"
import type { Category, LogEntry } from "@/types"
import { format, parseISO, subDays } from "date-fns"
import { toast } from "sonner"

interface QuickAddDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  onUncategorized?: (eventType: string) => void
  date: string
  editEntry?: { id: number; time: string; event: string; detail: string } | null
  initialTime?: string | null
}

interface DurationPreview {
  tone: "info" | "muted"
  label: string
  detail: string
}

function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return hours * 60 + minutes
}

function getEntryMode(entry: Pick<LogEntry, "time_point_mode">, fallbackMode: string) {
  return entry.time_point_mode || fallbackMode
}

function diffMinutes(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  const from = new Date(`${fromDate}T${fromTime.slice(0, 5)}:00`)
  const to = new Date(`${toDate}T${toTime.slice(0, 5)}:00`)
  const diff = Math.floor((to.getTime() - from.getTime()) / 60000)
  return Math.max(0, diff)
}

function buildEndModeDurationPreview(
  currentDate: string,
  currentTime: string,
  entries: LogEntry[],
  previousDayLastEntry: LogEntry | null,
  fallbackMode: string,
): DurationPreview | null {
  const currentMinutes = parseTimeToMinutes(currentTime)
  if (currentMinutes === null) return null

  const previousSameDay = [...entries]
    .filter((entry) => {
      const entryMinutes = parseTimeToMinutes(entry.log_time)
      return entryMinutes !== null && entryMinutes <= currentMinutes
    })
    .sort((a, b) => a.log_time.localeCompare(b.log_time))
  const lastSameDayEntry = previousSameDay.length > 0 ? previousSameDay[previousSameDay.length - 1] : null

  const previousEntry = lastSameDayEntry || previousDayLastEntry
  if (!previousEntry) {
    return {
      tone: "muted",
      label: "持续待定",
      detail: "暂无起点",
    }
  }

  const previousMode = getEntryMode(previousEntry, fallbackMode)
  if (previousMode !== "end") {
    return {
      tone: "muted",
      label: "持续待定",
      detail: "模式边界",
    }
  }

  const durationMinutes = diffMinutes(previousEntry.log_date, previousEntry.log_time, currentDate, currentTime)
  const display = durationMinutes > 0 ? formatDuration(durationMinutes * 60) : "0m"
  const previousTime = previousEntry.log_time.slice(0, 5)
  const rangeText = previousEntry.log_date === currentDate
    ? `${previousTime} ~ ${currentTime.slice(0, 5)}`
    : `昨日 ${previousTime} ~ 今日 ${currentTime.slice(0, 5)}`

  return {
    tone: "info",
    label: `持续 ${display}`,
    detail: rangeText,
  }
}

export function QuickAddDialog({ open, onClose, onCreated, onUncategorized, date, editEntry, initialTime }: QuickAddDialogProps) {
  // Key forces remount when switching between edit targets or initial times
  const dialogKey = open ? `${editEntry?.id ?? "new"}-${initialTime ?? ""}` : "closed"

  return (
    <AnimatePresence>
      {open && (
        <QuickAddDialogInner
          key={dialogKey}
          onClose={onClose}
          onCreated={onCreated}
          onUncategorized={onUncategorized}
          date={date}
          editEntry={editEntry}
          initialTime={initialTime}
        />
      )}
    </AnimatePresence>
  )
}

function QuickAddDialogInner({
  onClose,
  onCreated,
  onUncategorized,
  date,
  editEntry,
  initialTime,
}: Omit<QuickAddDialogProps, "open">) {
  const isEdit = !!editEntry

  const [timeValue, setTimeValue] = useState(() => {
    if (editEntry) return editEntry.time
    if (initialTime) return initialTime
    return ""
  })
  const [eventValue, setEventValue] = useState(editEntry?.event ?? "")
  const [detailValue, setDetailValue] = useState(editEntry?.detail ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allEvents, setAllEvents] = useState<string[]>([])
  const [timelineEntries, setTimelineEntries] = useState<LogEntry[]>([])
  const [previousDayEntries, setPreviousDayEntries] = useState<LogEntry[]>([])
  const [timePointMode, setTimePointMode] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [validationError, setValidationError] = useState(false)

  const eventInputRef = useRef<HTMLInputElement>(null)

  // Check if form has meaningful content that would be lost
  const hasContent = useMemo(() => {
    if (isEdit) {
      // In edit mode, check if anything changed from original
      return (
        timeValue !== editEntry!.time ||
        eventValue !== editEntry!.event ||
        detailValue !== (editEntry!.detail ?? "")
      )
    }
    // In new mode, check if user has typed anything
    return !!(eventValue.trim() || detailValue.trim())
  }, [isEdit, timeValue, eventValue, detailValue, editEntry])

  const tryClose = useCallback(() => {
    if (hasContent) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }, [hasContent, onClose])

  useEffect(() => {
    if (!date) return
    const previousDate = format(subDays(parseISO(date), 1), "yyyy-MM-dd")
    // Defer data loading to avoid layout shift during enter animation
    const timer = setTimeout(() => {
      Promise.all([
        getCategories().catch(() => [] as Category[]),
        getEventTypes().catch(() => [] as string[]),
        getTimeline(date).catch(() => [] as LogEntry[]),
        getTimeline(previousDate).catch(() => [] as LogEntry[]),
        getSettings().catch(() => null),
      ]).then(([cats, types, entries, prevEntries, settings]) => {
        setCategories(cats || [])
        setTimelineEntries(entries || [])
        setPreviousDayEntries(prevEntries || [])
        setTimePointMode(settings?.time_point_mode || null)
        const recent = [...new Set(entries.map((e) => e.event_type))].reverse()
        const fixedEvents: string[] = []
        ;(cats || []).forEach((cat) =>
          cat.rules.forEach((r) => {
            if (r.type === "fixed") fixedEvents.push(r.pattern)
          })
        )
        setAllEvents([...new Set([...recent, ...fixedEvents, ...types])])
        setDataReady(true)
      })
    }, 250)
    setTimeout(() => eventInputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [date])

  const suggestions: SuggestionTag[] = useMemo(() => {
    return allEvents.map((name) => {
      const cat = categories.find((c) =>
        c.rules.some((r) => {
          if (r.type === "fixed") return r.pattern === name
          try { return new RegExp(r.pattern).test(name) } catch { return false }
        })
      )
      return { name, categoryName: cat?.name, categoryColor: cat?.color }
    })
  }, [allEvents, categories])

  const endModeDurationPreview = useMemo(() => {
    if (!dataReady || isEdit || timePointMode !== "end") return null
    const previousDayLastEntry = previousDayEntries.length > 0 ? previousDayEntries[previousDayEntries.length - 1] : null
    return buildEndModeDurationPreview(
      date,
      timeValue,
      timelineEntries,
      previousDayLastEntry,
      timePointMode,
    )
  }, [dataReady, isEdit, timePointMode, previousDayEntries, date, timeValue, timelineEntries])

  const editDurationPreview = useMemo((): DurationPreview | null => {
    if (!dataReady || !isEdit || !editEntry) return null
    const idx = timelineEntries.findIndex((e) => e.id === editEntry.id)
    if (idx < 0) return null

    const entry = timelineEntries[idx]
    const mode = getEntryMode(entry, timePointMode || "end")

    if (mode === "end") {
      const prevEntry = idx > 0 ? timelineEntries[idx - 1] : null
      if (!prevEntry) {
        const prevDayLast = previousDayEntries.length > 0 ? previousDayEntries[previousDayEntries.length - 1] : null
        if (!prevDayLast) return { tone: "muted", label: "持续待定", detail: "暂无起点" }
        const prevMode = getEntryMode(prevDayLast, timePointMode || "end")
        if (prevMode !== "end") return { tone: "muted", label: "持续待定", detail: "模式边界" }
        const mins = diffMinutes(prevDayLast.log_date, prevDayLast.log_time, entry.log_date, entry.log_time)
        const display = mins > 0 ? formatDuration(mins * 60) : "0m"
        const prevTime = prevDayLast.log_time.slice(0, 5)
        return { tone: "info", label: `持续 ${display}`, detail: `昨日 ${prevTime} ~ 今日 ${entry.log_time.slice(0, 5)}` }
      }
      const prevMode = getEntryMode(prevEntry, timePointMode || "end")
      if (prevMode !== "end") return { tone: "muted", label: "持续待定", detail: "模式边界" }
      const mins = diffMinutes(prevEntry.log_date, prevEntry.log_time, entry.log_date, entry.log_time)
      const display = mins > 0 ? formatDuration(mins * 60) : "0m"
      return { tone: "info", label: `持续 ${display}`, detail: `${prevEntry.log_time.slice(0, 5)} ~ ${entry.log_time.slice(0, 5)}` }
    }

    if (mode === "start") {
      const nextEntry = idx < timelineEntries.length - 1 ? timelineEntries[idx + 1] : null
      if (!nextEntry) return { tone: "muted", label: "持续待定", detail: "暂无终点" }
      const mins = diffMinutes(entry.log_date, entry.log_time, nextEntry.log_date, nextEntry.log_time)
      const display = mins > 0 ? formatDuration(mins * 60) : "0m"
      return { tone: "info", label: `持续 ${display}`, detail: `${entry.log_time.slice(0, 5)} ~ ${nextEntry.log_time.slice(0, 5)}` }
    }

    return null
  }, [dataReady, isEdit, editEntry, timelineEntries, previousDayEntries, timePointMode])

  const handleSubmit = async () => {
    if (!timeValue.trim() || !eventValue.trim()) {
      setValidationError(true)
      setTimeout(() => setValidationError(false), 600)
      return
    }
    setSubmitting(true)
    try {
      if (editEntry) {
        await updateLog(editEntry.id, {
          log_time: timeValue,
          event_type: eventValue.trim(),
          detail: detailValue.trim() || undefined,
        })
        toast.success("更新成功")
        window.dispatchEvent(new CustomEvent("entryUpdated", { detail: editEntry.id }))
      } else {
        const entry = await createLog({
          log_date: date,
          log_time: timeValue,
          event_type: eventValue.trim(),
          detail: detailValue.trim() || undefined,
        })
        toast.success("记录成功")
        if (entry.category === "未分类") {
          onUncategorized?.(eventValue.trim())
        }
      }
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "提交失败"
      toast.error(isEdit ? "更新失败" : "提交失败", { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={tryClose}
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
      />
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-background rounded-2xl shadow-2xl border max-w-md mx-auto max-h-[80vh] flex flex-col"
      >
        {/* Fixed header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <h3 className="text-base font-semibold">{isEdit ? "编辑记录" : "快速记录"}</h3>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={tryClose}
            className="rounded-full text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <EventForm
            time={timeValue}
            event={eventValue}
            detail={detailValue}
            onTimeChange={setTimeValue}
            onEventChange={setEventValue}
            onDetailChange={setDetailValue}
            onSubmit={handleSubmit}
            showActions={false}
            suggestions={suggestions}
            eventInputRef={eventInputRef}
            initialDetailOpen={isEdit && !!detailValue}
            durationPreview={editDurationPreview ?? endModeDurationPreview}
            validationError={validationError}
          />
        </div>

        {/* Fixed footer */}
        <div className="px-5 pb-5 pt-3 border-t shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !eventValue.trim() || !timeValue.trim()}
            className="w-full h-11 rounded-xl text-base font-medium"
          >
            {submitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
              />
            ) : isEdit ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                保存
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                记录
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Close confirmation overlay */}
      <AnimatePresence>
        {confirmClose && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/20"
              onClick={() => setConfirmClose(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] bg-background rounded-xl shadow-2xl border p-5 w-[280px]"
            >
              <p className="text-sm font-medium mb-1">确认放弃{isEdit ? "编辑" : "输入"}？</p>
              <p className="text-xs text-muted-foreground mb-4">当前内容尚未保存，关闭后将丢失。</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmClose(false)}
                >
                  继续{isEdit ? "编辑" : "输入"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={onClose}
                >
                  放弃
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
