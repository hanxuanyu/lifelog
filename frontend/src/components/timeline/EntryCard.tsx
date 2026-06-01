import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Maximize2, CalendarClock, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LogEntry, DurationItem } from "@/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { formatTime, timeToMinutes, getContrastText, SWIPE_ACTION_WIDTH } from "./shared"

interface EntryCardProps {
  entry: LogEntry
  index: number
  color: string
  durItem: DurationItem | null
  highlightIndex: number | null
  expandedEntryId: number | null
  swipedEntryId: number | null
  isToday: boolean
  currentTime: string
  onCardClick: (entry: LogEntry) => void
  onCardContextMenu: (e: React.MouseEvent, entry: LogEntry) => void
  onCardTouchStart: (e: React.TouchEvent, entry: LogEntry) => void
  onCardTouchMove: (e: React.TouchEvent) => void
  onCardTouchEnd: (entry: LogEntry) => void
  onHighlightEnter: (index: number) => void
  onHighlightLeave: () => void
  onEditRequest?: (entry: LogEntry) => void
  onDeleteRequest: (id: number) => void
  onDetailView: (title: string, detail: string, time: string) => void
  onAssignCategory: (eventType: string) => void
  setCardRef: (id: number) => (el: HTMLDivElement | null) => void
  setSwipedEntryId: (id: number | null) => void
  highlighted?: boolean
}

export function EntryCard({
  entry,
  index,
  color,
  durItem,
  highlightIndex,
  expandedEntryId,
  swipedEntryId,
  isToday,
  currentTime,
  onCardClick,
  onCardContextMenu,
  onCardTouchStart,
  onCardTouchMove,
  onCardTouchEnd,
  onHighlightEnter,
  onHighlightLeave,
  onEditRequest,
  onDeleteRequest,
  onDetailView,
  onAssignCategory,
  setCardRef,
  setSwipedEntryId,
  highlighted,
}: EntryCardProps) {
  const detailPreview = useMemo(() => {
    if (!entry.detail) return ""
    return entry.detail
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[([xX ])\]\s*/g, (_, c) => c.trim().toLowerCase() === "x" ? "\u2611 " : "\u2610 ")
      .replace(/[*_~`>|]/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim()
  }, [entry.detail])

  const isMarker = entry.is_marker || entry.time_point_mode === "mark"
  const isUncategorized = entry.category === "未分类"
  const displayEventType = isMarker ? "待补全事项" : entry.event_type
  const displayCategory = isMarker ? "待完善" : entry.category
  const hasTimeRange = !!(durItem?.start_time && durItem?.end_time && !durItem.unknown)
  const timeText = hasTimeRange
    ? `${formatTime(durItem!.start_time)}~${formatTime(durItem!.end_time)}`
    : `${formatTime(entry.log_time)}(结束)`
  const showDuration = !!(durItem && !durItem.unknown && durItem.duration > 0)

  const isFuturePlan = useMemo(() => {
    if (!isToday) return false
    if (isMarker) return false
    if (durItem?.cross_day) return false

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    if (entry.log_date < todayStr) return false
    if (entry.log_date > todayStr) return true

    const entryTime = durItem?.start_time ? formatTime(durItem.start_time) : formatTime(entry.log_time)
    return timeToMinutes(entryTime) > timeToMinutes(currentTime)
  }, [currentTime, durItem?.cross_day, durItem?.start_time, entry.log_date, entry.log_time, isMarker, isToday])

  const isOngoing = useMemo(() => {
    if (!isToday || isFuturePlan || isMarker) return false

    const currentMinutes = timeToMinutes(currentTime)

    if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) {
      const startMinutes = timeToMinutes(formatTime(durItem.start_time))
      const endMinutes = timeToMinutes(formatTime(durItem.end_time))

      if (durItem.cross_day) return currentMinutes < endMinutes

      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }

    if (durItem?.unknown) {
      return timeToMinutes(formatTime(entry.log_time)) <= currentMinutes
    }

    return false
  }, [currentTime, durItem, entry.log_time, isFuturePlan, isMarker, isToday])

  return (
    <motion.div
      ref={setCardRef(entry.id)}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, scale: 0.95 }}
      transition={{ delay: index * 0.02 }}
      className="mb-1.5"
    >
      <div className="relative overflow-hidden rounded-r-xl">
        <motion.div
          className={`group cursor-pointer select-none rounded-r-xl border-y border-r border-l-0 px-2.5 py-1.5 shadow-sm transition-[box-shadow,background-color,border-color] duration-150 active:brightness-90 ${
            highlightIndex === index ? "brightness-95 shadow-md" : "hover:brightness-95"
          } ${highlighted ? "animate-[pulse_0.8s_ease-in-out_2] ring-2 ring-primary/30" : ""}`}
          style={{
            backgroundColor: highlightIndex === index ? `${color}33` : `${color}1a`,
            borderColor: highlightIndex === index ? `${color}50` : `${color}33`,
            WebkitTouchCallout: "none",
            touchAction: "pan-y",
          }}
          onClick={() => {
            if (swipedEntryId === entry.id) {
              setSwipedEntryId(null)
              return
            }
            onCardClick(entry)
          }}
          onContextMenu={(event) => onCardContextMenu(event, entry)}
          onMouseEnter={() => onHighlightEnter(index)}
          onMouseLeave={onHighlightLeave}
          onTouchStart={(event) => {
            onHighlightEnter(index)
            onCardTouchStart(event, entry)
          }}
          onTouchMove={onCardTouchMove}
          onTouchEnd={() => {
            onCardTouchEnd(entry)
            setTimeout(onHighlightLeave, 150)
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium">{displayEventType}</span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium${isUncategorized && !isMarker ? " cursor-pointer transition-opacity hover:opacity-80" : ""}`}
                  style={{ backgroundColor: color, color: getContrastText(color) }}
                  onClick={isUncategorized && !isMarker ? (event) => { event.stopPropagation(); onAssignCategory(entry.event_type) } : undefined}
                  title={isUncategorized && !isMarker ? "点击分配分类" : undefined}
                >
                  {displayCategory}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {timeText}
                </span>
                {showDuration && (
                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {durItem!.display}
                  </span>
                )}
                {durItem?.unknown && !isMarker && (
                  <span className="text-[10px] italic text-muted-foreground/60">{durItem.display}</span>
                )}
                {isFuturePlan && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <CalendarClock className="h-3 w-3" />
                    计划
                  </span>
                )}
                {isOngoing && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <PlayCircle className="h-3 w-3" />
                    进行中
                  </span>
                )}
              </div>

              {entry.detail && (
                <AnimatePresence initial={false}>
                  {expandedEntryId === entry.id ? (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-1 overflow-hidden"
                    >
                      <div className="prose-compact min-w-0 text-xs text-muted-foreground">
                        <MarkdownRenderer content={entry.detail} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="collapsed"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-0.5"
                    >
                      <p className="truncate text-xs text-muted-foreground">{detailPreview}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:flex sm:transition-opacity">
              {entry.detail && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDetailView(displayEventType, entry.detail, formatTime(entry.log_time))
                  }}
                  title="查看详情"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditRequest?.(entry)
                }}
                title="编辑"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteRequest(entry.id)
                }}
                title="删除"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </motion.div>

        <div
          data-swipe-actions
          data-open={swipedEntryId === entry.id ? "true" : "false"}
          className="absolute top-0 right-0 bottom-0 flex items-center gap-0.5 px-1 sm:hidden"
          style={{
            transform: swipedEntryId === entry.id ? "translateX(0)" : `translateX(${SWIPE_ACTION_WIDTH}px)`,
            opacity: swipedEntryId === entry.id ? 1 : 0,
            transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
          }}
        >
          {entry.detail && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(event) => {
                event.stopPropagation()
                setSwipedEntryId(null)
                onDetailView(displayEventType, entry.detail, formatTime(entry.log_time))
              }}
              title="查看详情"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(event) => {
              event.stopPropagation()
              setSwipedEntryId(null)
              onEditRequest?.(entry)
            }}
            title="编辑"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation()
              setSwipedEntryId(null)
              onDeleteRequest(entry.id)
            }}
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
