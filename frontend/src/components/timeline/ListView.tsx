import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarPlus } from "lucide-react"
import type { LogEntry, DurationItem, CrossDayHint } from "@/types"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatTime,
  formatDuration,
  timeToMinutes,
  RAIL_WIDTH,
  GAP,
  RAIL_PADDING,
  RAIL_LINE_X,
} from "./shared"
import { useCardGestures } from "./useCardGestures"
import { useRailInteraction } from "./useRailInteraction"
import { RailSvg } from "./RailSvg"
import { CurveSvg } from "./CurveSvg"
import { EntryCard } from "./EntryCard"
import { CardContextMenu } from "./CardContextMenu"

interface ListViewProps {
  entries: LogEntry[]
  durationItems: DurationItem[]
  onUpdate: () => void
  onDeleteRequest: (id: number) => void
  getCategoryColor: (category: string) => string
  getDurationForEntry: (index: number) => DurationItem | null
  crossDayHints?: CrossDayHint[]
  prevDayLastTime?: string
  isToday: boolean
  currentTime: string
  timePointMode?: string
  onEditRequest?: (entry: LogEntry) => void
  onRailCreate?: (time: string) => void
  highlightedEntryId?: number | null
}

export function ListView({
  entries, durationItems, onUpdate, onDeleteRequest, getCategoryColor,
  getDurationForEntry, crossDayHints = [], prevDayLastTime, isToday, currentTime,
  timePointMode = "end", onEditRequest, onRailCreate, highlightedEntryId,
}: ListViewProps) {
  const getEntryMode = useCallback(
    (entry: LogEntry) => entry.time_point_mode || timePointMode,
    [timePointMode]
  )

  // State
  const [detailDialog, setDetailDialog] = useState<{ title: string; detail: string; time: string } | null>(null)
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; eventType: string }>({ open: false, eventType: "" })
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ entry: LogEntry; x: number; y: number } | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const [railHeight, setRailHeight] = useState(0)
  const [cardPositions, setCardPositions] = useState<{ top: number; bottom: number }[]>([])
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [ghostCardPositions, setGhostCardPositions] = useState<Map<string, { top: number; bottom: number }>>(new Map())

  // Refs
  const highlightSourceRef = useRef<"rail" | "card" | null>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const cardsScrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const ghostCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const curveSvgRef = useRef<SVGSVGElement>(null)
  const scrollTopRef = useRef(0)
  const rafIdRef = useRef(0)

  // Hooks
  const { swipedEntryId, setSwipedEntryId, handleCardClick, handleCardTouchStart, handleCardTouchMove, handleCardTouchEnd } =
    useCardGestures({
      expandedEntryId,
      onEditRequest,
      onExpandToggle: (id) => setExpandedEntryId((prev) => (prev === id ? null : id)),
      onContextMenu: (entry, x, y) => setContextMenu({ entry, x, y }),
    })

  const { hoverTime, setHoverTime, isTouching, handleRailHover, handleRailClick } =
    useRailInteraction({ railRef, railHeight, onRailCreate })

  // One-time swipe hint: auto-peek first card on mobile
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 640) return
    if (entries.length === 0) return
    if (localStorage.getItem("swipe_hint_shown")) return

    const timer = setTimeout(() => {
      setSwipedEntryId(entries[0].id)
      localStorage.setItem("swipe_hint_shown", "1")
      setTimeout(() => setSwipedEntryId(null), 1200)
    }, 800)
    return () => clearTimeout(timer)
  }, [entries, setSwipedEntryId])

  // Computed
  const usableHeight = Math.max(0, railHeight - RAIL_PADDING * 2)
  const timeToRailY = useCallback(
    (timeStr: string): number => RAIL_PADDING + (timeToMinutes(timeStr) / 1440) * usableHeight,
    [usableHeight]
  )
  const currentTimeRailY = isToday ? timeToRailY(currentTime) : -1
  const hoverRailY = hoverTime ? timeToRailY(hoverTime) : -1

  const hoverGapInfo = useMemo(() => {
    if (!hoverTime) return null
    const hoverMins = timeToMinutes(hoverTime)

    // Find the closest entry whose log_time <= hoverTime
    let prev: LogEntry | null = null
    for (let i = entries.length - 1; i >= 0; i--) {
      if (timeToMinutes(formatTime(entries[i].log_time)) <= hoverMins) {
        prev = entries[i]
        break
      }
    }

    // Cross-day fallback: use previous day's last entry time
    const prevTime = prev
      ? formatTime(prev.log_time)
      : prevDayLastTime || null

    if (!prevTime) return null

    // Respect time_point_mode: only show gap when previous entry is "end" mode
    if (prev) {
      const prevMode = prev.time_point_mode || timePointMode
      if (prevMode !== "end") return null
    }

    const gap = prev
      ? hoverMins - timeToMinutes(prevTime)
      : hoverMins + (24 * 60 - timeToMinutes(prevTime)) // cross-day: remaining of prev day + current day

    if (gap <= 0) return null

    const gapDisplay = formatDuration(gap * 60)
    const detail = prev
      ? `${prevTime} ~ ${hoverTime}`
      : `昨日 ${prevTime} ~ ${hoverTime}`

    return { gapDisplay, prevTime, detail, crossDay: !prev }
  }, [hoverTime, entries, prevDayLastTime, timePointMode])

  const durationToEntryMap = useMemo(() => {
    const map = new Map<number, number>()
    entries.forEach((_, i) => {
      const dur = getDurationForEntry(i)
      if (dur) { const durIdx = durationItems.indexOf(dur); if (durIdx >= 0) map.set(durIdx, i) }
    })
    return map
  }, [entries, durationItems, getDurationForEntry])

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return
    const close = closeContextMenu
    window.addEventListener("scroll", close, true)
    window.addEventListener("pointerdown", close)
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("pointerdown", close) }
  }, [contextMenu])

  // Track rail height
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const update = () => setRailHeight(rail.clientHeight)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(rail)
    return () => obs.disconnect()
  }, [])

  // Scroll highlighted card into view when highlight comes from rail
  useEffect(() => {
    if (highlightIndex === null || highlightSourceRef.current !== "rail") return
    const entry = entries[highlightIndex]
    if (!entry) return
    const el = cardRefs.current.get(entry.id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [highlightIndex, entries])

  useEffect(() => {
    if (typeof highlightedEntryId !== "number") return
    const el = cardRefs.current.get(highlightedEntryId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [highlightedEntryId])

  // Curve path updates (imperative DOM manipulation)
  const updateCurvePaths = useCallback(() => {
    const svg = curveSvgRef.current
    if (!svg || railHeight <= 0 || cardPositions.length !== entries.length) return
    const st = scrollTopRef.current
    const cx = RAIL_LINE_X
    const curveEndX = RAIL_WIDTH + GAP

    svg.querySelectorAll<SVGPathElement>('[data-curve-index]').forEach((pathEl) => {
      const i = Number(pathEl.dataset.curveIndex)
      if (i < 0 || i >= entries.length) return
      const entry = entries[i]
      const cardTop = cardPositions[i].top - st
      const cardBottom = cardPositions[i].bottom - st
      const durItem = getDurationForEntry(i)

      if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) {
        let railTop: number, railBottom: number
        if (durItem.cross_day) {
          const mode = durItem.time_point_mode || getEntryMode(entry)
          if (mode === "end") { railTop = timeToRailY("00:00"); railBottom = timeToRailY(formatTime(durItem.end_time)) }
          else { railTop = timeToRailY(formatTime(durItem.start_time)); railBottom = timeToRailY("23:59") }
        } else { railTop = timeToRailY(formatTime(durItem.start_time)); railBottom = timeToRailY(formatTime(durItem.end_time)) }
        if (railBottom <= railTop) railBottom = railTop + 2
        const railEdge = cx + 3, midX = railEdge + (curveEndX - railEdge) * 0.5
        pathEl.setAttribute('d', `M ${railEdge} ${railTop} C ${midX} ${railTop}, ${midX} ${cardTop}, ${curveEndX} ${cardTop} L ${curveEndX} ${cardBottom} C ${midX} ${cardBottom}, ${midX} ${railBottom}, ${railEdge} ${railBottom} Z`)
      } else {
        const dotY = timeToRailY(formatTime(entry.log_time))
        const cardCenterY = (cardTop + cardBottom) / 2
        const cpX = cx + (curveEndX - cx) * 0.6
        pathEl.setAttribute('d', `M ${cx} ${dotY} C ${cpX} ${dotY}, ${cpX} ${cardCenterY}, ${curveEndX} ${cardCenterY}`)
        const circle = svg.querySelector<SVGCircleElement>(`[data-circle-index="${i}"]`)
        if (circle) circle.setAttribute('cy', String(cardCenterY))
      }
    })

    svg.querySelectorAll<SVGPathElement>('[data-ghost-curve-key]').forEach((pathEl) => {
      const key = pathEl.dataset.ghostCurveKey
      if (!key) return
      const pos = ghostCardPositions.get(key)
      if (!pos) return
      const [direction, idxStr] = key.split("-")
      const hint = crossDayHints.filter((h) => h.direction === direction)[Number(idxStr)]
      if (!hint) return
      const railTop = timeToRailY(formatTime(hint.start_time))
      const railBottom = timeToRailY(formatTime(hint.end_time))
      if (railBottom <= railTop) return
      const cardTop = pos.top - st, cardBottom = pos.bottom - st
      const railEdge = cx + 3, midX = railEdge + (curveEndX - railEdge) * 0.5
      pathEl.setAttribute('d', `M ${railEdge} ${railTop} C ${midX} ${railTop}, ${midX} ${cardTop}, ${curveEndX} ${cardTop} L ${curveEndX} ${cardBottom} C ${midX} ${cardBottom}, ${midX} ${railBottom}, ${railEdge} ${railBottom} Z`)
    })
  }, [entries, cardPositions, railHeight, getDurationForEntry, getEntryMode, timeToRailY, crossDayHints, ghostCardPositions])

  useEffect(() => {
    const el = cardsScrollRef.current
    if (!el) return
    const onScroll = () => { scrollTopRef.current = el.scrollTop; cancelAnimationFrame(rafIdRef.current); rafIdRef.current = requestAnimationFrame(updateCurvePaths) }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(rafIdRef.current) }
  }, [updateCurvePaths])

  useEffect(() => { updateCurvePaths() }, [updateCurvePaths])

  // Measure card positions
  const measurePositions = useCallback(() => {
    const scrollEl = cardsScrollRef.current
    if (!scrollEl) return
    setCardPositions(entries.map((entry) => {
      const el = cardRefs.current.get(entry.id)
      if (!el) return { top: 0, bottom: 0 }
      return { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }
    }))
    const ghostPositions = new Map<string, { top: number; bottom: number }>()
    ghostCardRefs.current.forEach((el, key) => { ghostPositions.set(key, { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }) })
    setGhostCardPositions(ghostPositions)
  }, [entries])

  useEffect(() => { requestAnimationFrame(measurePositions) }, [measurePositions])

  useEffect(() => {
    const scrollEl = cardsScrollRef.current
    if (!scrollEl) return
    const obs = new ResizeObserver(() => requestAnimationFrame(measurePositions))
    obs.observe(scrollEl)
    cardRefs.current.forEach((el) => obs.observe(el))
    ghostCardRefs.current.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [measurePositions])

  const setCardRef = useCallback((id: number) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el); else cardRefs.current.delete(id)
  }, [])

  const closeContextMenu = () => { setContextMenu(null); setMenuPos(null) }
  const handleCardContextMenu = (e: React.MouseEvent, entry: LogEntry) => { e.preventDefault(); setContextMenu({ entry, x: e.clientX, y: e.clientY }) }

  // Ghost card renderer
  const renderGhostCard = (hint: CrossDayHint, i: number, direction: "prev" | "next") => {
    const color = getCategoryColor(hint.category)
    const refKey = `${direction}-${i}`
    return (
      <motion.div key={`ghost-${direction}-${i}`}
        ref={(el: HTMLDivElement | null) => { if (el) ghostCardRefs.current.set(refKey, el); else ghostCardRefs.current.delete(refKey) }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-1.5">
        <div className="rounded-r-xl border-y border-r border-l-0 border-dashed px-2.5 py-1.5 opacity-50"
          style={{ backgroundColor: `${color}0d`, borderColor: `${color}33` }}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate text-muted-foreground">{hint.event_type}</span>
            <span className="text-[11px] font-mono text-muted-foreground">{formatTime(hint.start_time)}~{formatTime(hint.end_time)}</span>
            <span className="text-[10px] text-muted-foreground/60 italic">{direction === "prev" ? "接续上一天" : "延续至下一天"}</span>
          </div>
        </div>
      </motion.div>
    )
  }

  // Shared rail props
  const railContainerProps = {
    ref: railRef,
    className: "relative shrink-0 cursor-crosshair touch-none",
    style: { width: RAIL_WIDTH },
    onMouseMove: handleRailHover,
    onMouseLeave: () => { setHoverTime(null); if (highlightSourceRef.current === "rail") setHighlightIndex(null) },
    onClick: handleRailClick,
  } as const

  const railSvgProps = {
    railHeight, usableHeight, timeToRailY, durationItems, entries, crossDayHints,
    getCategoryColor, getDurationForEntry, getEntryMode, durationToEntryMap,
    highlightIndex, highlightSourceRef, setHighlightIndex,
    isToday, currentTimeRailY, hoverTime, hoverRailY, isTouching, timePointMode, currentTime,
    hoverGapInfo,
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 min-h-0">
        <div {...railContainerProps}><RailSvg {...railSvgProps} /></div>
        <div className="flex-1 min-w-0 flex items-center justify-center" style={{ marginLeft: GAP }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-muted-foreground">
            <CalendarPlus className="w-10 h-10 mb-3 stroke-[1.2]" />
            <p className="text-sm">当前日期暂无生活记录</p>
            <p className="text-xs mt-1">点击左侧时间轴、右上角 + 按钮或使用快捷键创建</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="flex flex-1 min-h-0 relative">
      <div {...railContainerProps}><RailSvg {...railSvgProps} /></div>

      <CurveSvg svgRef={curveSvgRef} railHeight={railHeight} entries={entries}
        crossDayHints={crossDayHints} getCategoryColor={getCategoryColor}
        getDurationForEntry={getDurationForEntry} highlightIndex={highlightIndex} />

      <div ref={cardsScrollRef} className="flex-1 min-w-0 overflow-y-auto overscroll-none scrollbar-hide pt-2 pr-1"
        style={{ marginLeft: GAP, paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        <AnimatePresence mode="popLayout">
          {crossDayHints.filter((h) => h.direction === "prev").map((hint, i) => renderGhostCard(hint, i, "prev"))}

          {entries.map((entry, index) => (
            <div key={entry.id}>
              <EntryCard
                entry={entry} index={index} color={getCategoryColor(entry.category)}
                durItem={getDurationForEntry(index)} highlightIndex={highlightIndex}
                expandedEntryId={expandedEntryId} swipedEntryId={swipedEntryId}
                isToday={isToday} currentTime={currentTime}
                getEntryMode={getEntryMode} onCardClick={handleCardClick}
                onCardContextMenu={handleCardContextMenu}
                onCardTouchStart={handleCardTouchStart} onCardTouchMove={handleCardTouchMove}
                onCardTouchEnd={handleCardTouchEnd}
                onHighlightEnter={(i) => { highlightSourceRef.current = "card"; setHighlightIndex(i) }}
                onHighlightLeave={() => { if (highlightSourceRef.current === "card") setHighlightIndex(null) }}
                onEditRequest={onEditRequest} onDeleteRequest={onDeleteRequest}
                onDetailView={(title, detail, time) => setDetailDialog({ title, detail, time })}
                onAssignCategory={(eventType) => setAssignDialog({ open: true, eventType })}
                setCardRef={setCardRef} setSwipedEntryId={setSwipedEntryId}
                highlighted={highlightedEntryId === entry.id}
              />
            </div>
          ))}

          {crossDayHints.filter((h) => h.direction === "next").map((hint, i) => renderGhostCard(hint, i, "next"))}
        </AnimatePresence>
      </div>

      <CardContextMenu contextMenu={contextMenu} menuPos={menuPos} setMenuPos={setMenuPos}
        onClose={closeContextMenu} onEditRequest={onEditRequest} onDeleteRequest={onDeleteRequest}
        onDetailView={(title, detail, time) => setDetailDialog({ title, detail, time })}
        onAssignCategory={(eventType) => setAssignDialog({ open: true, eventType })} />

      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span>{detailDialog?.title}</span>
              <span className="text-xs font-normal text-muted-foreground">{detailDialog?.time}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">事件详情</DialogDescription>
          </DialogHeader>
          <div className="prose-compact text-sm">
            <MarkdownRenderer content={detailDialog?.detail ?? ""} />
          </div>
        </DialogContent>
      </Dialog>

      <CategoryAssignDialog open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        eventType={assignDialog.eventType} onAssigned={() => onUpdate()} />
    </div>
  )
}
