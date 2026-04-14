import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { deleteLog } from "@/api"
import type { LogEntry, Category, DurationItem, CrossDayHint } from "@/types"
import { toast } from "sonner"
import { getCategoryColorFn } from "./shared"
import { ListView } from "./ListView"

interface TimelineProps {
  entries: LogEntry[]
  onUpdate: () => void
  categories?: Category[]
  date?: string
  isToday?: boolean
  durationItems?: DurationItem[]
  crossDayHints?: CrossDayHint[]
  prevDayLastTime?: string
  timePointMode?: string
  onEditRequest?: (entry: LogEntry) => void
  onRailCreate?: (time: string) => void
  externalHighlightedEntryId?: number | null
}

export function Timeline({
  entries,
  onUpdate,
  categories,
  date,
  isToday = false,
  durationItems = [],
  crossDayHints = [],
  prevDayLastTime,
  timePointMode = "end",
  onEditRequest,
  onRailCreate,
  externalHighlightedEntryId,
}: TimelineProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set())
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null)
  const pendingDeleteRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // Listen for entry update events to highlight the edited card
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as number
      setHighlightedEntryId(id)
      setTimeout(() => setHighlightedEntryId(null), 1500)
    }
    window.addEventListener("entryUpdated", handler)
    return () => window.removeEventListener("entryUpdated", handler)
  }, [])

  const visibleEntries = useMemo(
    () => entries.filter((e) => !hiddenIds.has(e.id)),
    [entries, hiddenIds],
  )

  const handleDeleteRequest = useCallback((id: number) => {
    // Optimistically hide the entry
    setHiddenIds((prev) => new Set(prev).add(id))

    // Show undo toast, delete on dismiss
    toast("已删除记录", {
      action: {
        label: "撤销",
        onClick: () => {
          // Cancel pending delete and restore
          const timer = pendingDeleteRef.current.get(id)
          if (timer) clearTimeout(timer)
          pendingDeleteRef.current.delete(id)
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      },
      duration: 4000,
      onDismiss: () => scheduleDelete(id),
      onAutoClose: () => scheduleDelete(id),
    })
  }, [])

  const scheduleDelete = useCallback((id: number) => {
    if (pendingDeleteRef.current.has(id)) return
    const timer = setTimeout(() => {
      pendingDeleteRef.current.delete(id)
      deleteLog(id)
        .then(() => onUpdate())
        .catch(() => {
          toast.error("删除失败")
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
    }, 0)
    pendingDeleteRef.current.set(id, timer)
  }, [onUpdate])
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  })

  // Update current time every 30s
  useEffect(() => {
    if (!isToday) return
    const tick = () => {
      const now = new Date()
      setCurrentTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      )
    }
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [isToday])

  const getCategoryColor = useCallback(
    (category: string) => getCategoryColorFn(category, categories),
    [categories]
  )

  const getDurationForEntry = useCallback(
    (index: number): DurationItem | null => {
      if (index < durationItems.length) return durationItems[index]
      return null
    },
    [durationItems]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <ListView
          entries={visibleEntries}
          durationItems={durationItems}
          onUpdate={onUpdate}
          onDeleteRequest={handleDeleteRequest}
          getCategoryColor={getCategoryColor}
          getDurationForEntry={getDurationForEntry}
          crossDayHints={crossDayHints}
          prevDayLastTime={prevDayLastTime}
          isToday={isToday}
          currentTime={currentTime}
          timePointMode={timePointMode}
          onEditRequest={onEditRequest}
          onRailCreate={onRailCreate}
          highlightedEntryId={externalHighlightedEntryId ?? highlightedEntryId}
        />
      </div>
    </div>
  )
}
