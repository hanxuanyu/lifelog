import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LogEntry, DurationItem } from "@/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { formatTime, getContrastText, SWIPE_ACTION_WIDTH } from "./shared"

interface EntryCardProps {
  entry: LogEntry
  index: number
  color: string
  durItem: DurationItem | null
  highlightIndex: number | null
  expandedEntryId: number | null
  swipedEntryId: number | null
  getEntryMode: (entry: LogEntry) => string
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
}

export function EntryCard({
  entry, index, color, durItem, highlightIndex, expandedEntryId, swipedEntryId,
  getEntryMode, onCardClick, onCardContextMenu, onCardTouchStart, onCardTouchMove,
  onCardTouchEnd, onHighlightEnter, onHighlightLeave, onEditRequest, onDeleteRequest,
  onDetailView, onAssignCategory, setCardRef, setSwipedEntryId,
}: EntryCardProps) {
  // Extract plain text preview from markdown for collapsed state
  const detailPreview = useMemo(() => {
    if (!entry.detail) return ""
    return entry.detail
      .replace(/^#{1,6}\s+/gm, "")           // headings
      .replace(/\[([xX ])\]\s*/g, (_, c) => c.trim().toLowerCase() === "x" ? "\u2611 " : "\u2610 ") // checkboxes
      .replace(/[*_~`>|]/g, "")               // inline formatting
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images
      .replace(/\n+/g, " ")                   // newlines to spaces
      .trim()
  }, [entry.detail])

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
          className={`group rounded-r-xl border-y border-r border-l-0 px-2.5 py-1.5 shadow-sm transition-[box-shadow,background-color,border-color] duration-150 cursor-pointer select-none active:brightness-90 ${
            highlightIndex === index ? "brightness-95 shadow-md" : "hover:brightness-95"
          }`}
          style={{
            backgroundColor: highlightIndex === index ? `${color}33` : `${color}1a`,
            borderColor: highlightIndex === index ? `${color}50` : `${color}33`,
            WebkitTouchCallout: "none", touchAction: "pan-y",
          }}
          onClick={() => { if (swipedEntryId === entry.id) { setSwipedEntryId(null); return }; onCardClick(entry) }}
          onContextMenu={(e) => onCardContextMenu(e, entry)}
          onMouseEnter={() => onHighlightEnter(index)}
          onMouseLeave={onHighlightLeave}
          onTouchStart={(e) => { onHighlightEnter(index); onCardTouchStart(e, entry) }}
          onTouchMove={onCardTouchMove}
          onTouchEnd={() => { onCardTouchEnd(entry); setTimeout(onHighlightLeave, 150) }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm truncate">{entry.event_type}</span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium${
                    entry.category === "未分类" ? " cursor-pointer hover:opacity-80 transition-opacity" : ""
                  }`}
                  style={{ backgroundColor: color, color: getContrastText(color) }}
                  onClick={entry.category === "未分类" ? (e) => { e.stopPropagation(); onAssignCategory(entry.event_type) } : undefined}
                  title={entry.category === "未分类" ? "点击分配分类" : undefined}
                >
                  {entry.category}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {durItem && !durItem.unknown && durItem.start_time && durItem.end_time
                    ? `${formatTime(durItem.start_time)}~${formatTime(durItem.end_time)}`
                    : `${formatTime(entry.log_time)}(${getEntryMode(entry) === "end" ? "结束" : "开始"})`}
                </span>
                {durItem && !durItem.unknown && durItem.duration > 0 && (
                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted">
                    {durItem.display}
                  </span>
                )}
                {durItem?.unknown && (
                  <span className="text-[10px] text-muted-foreground/60 italic">{durItem.display}</span>
                )}
              </div>
              {entry.detail && (
                <AnimatePresence initial={false}>
                  {expandedEntryId === entry.id ? (
                    <motion.div key="expanded" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-1">
                      <div className="text-xs text-muted-foreground prose-compact min-w-0">
                        <MarkdownRenderer content={entry.detail} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="collapsed" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{detailPreview}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:transition-opacity shrink-0 max-sm:hidden">
              {entry.detail && (
                <Button size="icon" variant="ghost" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onDetailView(entry.event_type, entry.detail, formatTime(entry.log_time)) }}
                  title="查看详情">
                  <Maximize2 className="h-3 w-3" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); onEditRequest?.(entry) }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDeleteRequest(entry.id) }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </motion.div>
        {/* Swipe action buttons — mobile only */}
        <div data-swipe-actions data-open={swipedEntryId === entry.id ? "true" : "false"}
          className="sm:hidden absolute top-0 bottom-0 right-0 flex items-center gap-0.5 px-1"
          style={{
            transform: swipedEntryId === entry.id ? "translateX(0)" : `translateX(${SWIPE_ACTION_WIDTH}px)`,
            opacity: swipedEntryId === entry.id ? 1 : 0,
            transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
          }}>
          {entry.detail && (
            <Button size="icon" variant="ghost" className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setSwipedEntryId(null); onDetailView(entry.event_type, entry.detail, formatTime(entry.log_time)) }}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); setSwipedEntryId(null); onEditRequest?.(entry) }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setSwipedEntryId(null); onDeleteRequest(entry.id) }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}