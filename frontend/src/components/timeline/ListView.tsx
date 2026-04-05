import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Check, X, Plus, Maximize2, CalendarPlus, Copy, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateLog, createLog } from "@/api"
import type { LogEntry, DurationItem } from "@/types"
import { toast } from "sonner"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { CategoryAssignDialog } from "@/components/CategoryAssignDialog"
import { showCategoryAssignToast } from "@/lib/category-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  type EditState,
  type QuickCreateState,
  formatTime,
  formatTimeInput,
  timeToMinutes,
  minutesToTime,
  getContrastText,
} from "./shared"

// Layout constants
const RAIL_WIDTH = 56 // Fixed rail column width (wider for left-side labels)
const GAP = 4 // Gap between rail and cards
const RAIL_PADDING = 12 // Top/bottom padding so dots aren't clipped
const RAIL_LINE_X = 42 // X position of the rail line (right side, leaving space for labels)

interface ListViewProps {
  entries: LogEntry[]
  durationItems: DurationItem[]
  onUpdate: () => void
  onDeleteRequest: (id: number) => void
  getCategoryColor: (category: string) => string
  getDurationForEntry: (index: number) => DurationItem | null
  date?: string
  isToday: boolean
  currentTime: string
  timePointMode?: string
}

const HOUR_MARKERS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]

export function ListView({
  entries,
  durationItems,
  onUpdate,
  onDeleteRequest,
  getCategoryColor,
  getDurationForEntry,
  date,
  isToday,
  currentTime,
  timePointMode = "end",
}: ListViewProps) {
  const [editingEntry, setEditingEntry] = useState<EditState | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null)
  const [hoverTime, setHoverTime] = useState<string | null>(null)
  const [isTouching, setIsTouching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailDialog, setDetailDialog] = useState<{ title: string; detail: string; time: string } | null>(null)
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; eventType: string }>({
    open: false,
    eventType: "",
  })
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    entry: LogEntry
    x: number
    y: number
  } | null>(null)
  const [railHeight, setRailHeight] = useState(0)
  const [cardPositions, setCardPositions] = useState<{top: number, bottom: number}[]>([])

  const wrapperRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const cardsScrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const curveSvgRef = useRef<SVGSVGElement>(null)
  const scrollTopRef = useRef(0)
  const rafIdRef = useRef(0)
  const editEventRef = useRef<HTMLInputElement>(null)
  const quickEventRef = useRef<HTMLInputElement>(null)
  const quickTimeRef = useRef<HTMLInputElement>(null)
  const editStartedRef = useRef(false)
  const quickCreateStartedRef = useRef(false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("pointerdown", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("pointerdown", close)
    }
  }, [contextMenu])

  // Focus management
  useEffect(() => {
    if (editingEntry && editStartedRef.current) {
      editStartedRef.current = false
      setTimeout(() => editEventRef.current?.focus(), 50)
    }
  }, [editingEntry])

  useEffect(() => {
    if (quickCreate && quickCreateStartedRef.current) {
      quickCreateStartedRef.current = false
      setTimeout(() => quickEventRef.current?.focus(), 50)
    }
  }, [quickCreate])

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

  // Time to Y position on rail (proportional to full day, with padding)
  const usableHeight = Math.max(0, railHeight - RAIL_PADDING * 2)
  const timeToRailY = useCallback(
    (timeStr: string): number => {
      return RAIL_PADDING + (timeToMinutes(timeStr) / 1440) * usableHeight
    },
    [usableHeight]
  )

  // Track scroll position — update curves via rAF, no React state
  const updateCurvePaths = useCallback(() => {
    const svg = curveSvgRef.current
    if (!svg || railHeight <= 0 || cardPositions.length !== entries.length) return

    const st = scrollTopRef.current
    const cx = RAIL_LINE_X
    const curveEndX = RAIL_WIDTH + GAP

    const paths = svg.querySelectorAll<SVGPathElement>('[data-curve-index]')
    paths.forEach((pathEl) => {
      const i = Number(pathEl.dataset.curveIndex)
      if (i < 0 || i >= entries.length) return
      const entry = entries[i]
      const cardTop = cardPositions[i].top - st
      const cardBottom = cardPositions[i].bottom - st
      const durItem = getDurationForEntry(i)

      if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) {
        let railTop: number, railBottom: number
        if (durItem.cross_day) {
          if (timePointMode === "end") {
            railTop = timeToRailY("00:00")
            railBottom = timeToRailY(formatTime(durItem.end_time))
          } else {
            railTop = timeToRailY(formatTime(durItem.start_time))
            railBottom = timeToRailY("23:59")
          }
        } else {
          railTop = timeToRailY(formatTime(durItem.start_time))
          railBottom = timeToRailY(formatTime(durItem.end_time))
        }
        if (railBottom <= railTop) railBottom = railTop + 2

        const railEdge = cx + 3
        const midX = railEdge + (curveEndX - railEdge) * 0.5
        pathEl.setAttribute('d', `M ${railEdge} ${railTop} C ${midX} ${railTop}, ${midX} ${cardTop}, ${curveEndX} ${cardTop} L ${curveEndX} ${cardBottom} C ${midX} ${cardBottom}, ${midX} ${railBottom}, ${railEdge} ${railBottom} Z`)
      } else {
        const dotY = timeToRailY(formatTime(entry.log_time))
        const cardCenterY = (cardTop + cardBottom) / 2
        const cpX = cx + (curveEndX - cx) * 0.6
        pathEl.setAttribute('d', `M ${cx} ${dotY} C ${cpX} ${dotY}, ${cpX} ${cardCenterY}, ${curveEndX} ${cardCenterY}`)

        // Update associated circle
        const circle = svg.querySelector<SVGCircleElement>(`[data-circle-index="${i}"]`)
        if (circle) circle.setAttribute('cy', String(cardCenterY))
      }
    })
  }, [entries, cardPositions, railHeight, getDurationForEntry, timePointMode, timeToRailY])

  useEffect(() => {
    const el = cardsScrollRef.current
    if (!el) return
    const onScroll = () => {
      scrollTopRef.current = el.scrollTop
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(updateCurvePaths)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [updateCurvePaths])

  // Also update curves when card positions or rail height change
  useEffect(() => {
    updateCurvePaths()
  }, [updateCurvePaths])

  // Measure card positions (relative to scroll container)
  const measurePositions = useCallback(() => {
    const scrollEl = cardsScrollRef.current
    if (!scrollEl) return
    const positions = entries.map((entry) => {
      const el = cardRefs.current.get(entry.id)
      if (!el) return { top: 0, bottom: 0 }
      return { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }
    })
    setCardPositions(positions)
  }, [entries])

  useEffect(() => {
    requestAnimationFrame(measurePositions)
  }, [measurePositions, editingEntry, quickCreate])

  useEffect(() => {
    const scrollEl = cardsScrollRef.current
    if (!scrollEl) return
    const obs = new ResizeObserver(() => requestAnimationFrame(measurePositions))
    obs.observe(scrollEl)
    // Also observe all cards
    cardRefs.current.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [measurePositions])

  const setCardRef = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(id, el)
      else cardRefs.current.delete(id)
    },
    []
  )

  // Edit handlers
  const startEdit = (entry: LogEntry) => {
    editStartedRef.current = true
    setEditingEntry({
      id: entry.id,
      time: formatTime(entry.log_time),
      event: entry.event_type,
      detail: entry.detail,
    })
  }

  const cancelEdit = () => setEditingEntry(null)

  // Card gesture handlers
  const handleCardClick = (entry: LogEntry) => {
    if (longPressFiredRef.current) return
    if (clickTimerRef.current) {
      // Double click — edit
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      startEdit(entry)
    } else {
      // Single click — expand/collapse detail (delayed to distinguish from double click)
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        if (entry.detail) {
          setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))
        }
      }, 250)
    }
  }

  const handleCardTouchStart = (e: React.TouchEvent, entry: LogEntry) => {
    longPressFiredRef.current = false
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    // Capture the DOM element now — React's synthetic event (and currentTarget)
    // will be nullified by the time the timeout fires.
    const target = e.currentTarget as HTMLElement
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      const rect = target.getBoundingClientRect()
      setContextMenu({
        entry,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(10)
    }, 500)
  }

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }

  const handleCardTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    touchStartPos.current = null
  }

  const handleCardContextMenu = (e: React.MouseEvent, entry: LogEntry) => {
    e.preventDefault()
    setContextMenu({
      entry,
      x: e.clientX,
      y: e.clientY,
    })
  }

  const saveEdit = async () => {
    if (!editingEntry) return
    try {
      await updateLog(editingEntry.id, {
        log_time: editingEntry.time,
        event_type: editingEntry.event,
        detail: editingEntry.detail || undefined,
      })
      toast.success("更新成功")
      setEditingEntry(null)
      onUpdate()
    } catch {
      toast.error("更新失败")
    }
  }

  const handleQuickCreate = async () => {
    if (!quickCreate || !quickCreate.event.trim()) return
    setSaving(true)
    try {
      const entry = await createLog({
        log_date: date,
        log_time: quickCreate.time,
        event_type: quickCreate.event.trim(),
        detail: quickCreate.detail || undefined,
      })
      toast.success("创建成功")
      if (entry.category === "未分类") {
        const evtType = quickCreate.event.trim()
        showCategoryAssignToast(evtType, () => {
          setAssignDialog({ open: true, eventType: evtType })
        })
      }
      setQuickCreate(null)
      onUpdate()
    } catch {
      toast.error("创建失败")
    } finally {
      setSaving(false)
    }
  }

  const getInsertIndex = (time: string): number => {
    for (let i = 0; i < entries.length; i++) {
      if (formatTime(entries[i].log_time) > time) return i
    }
    return entries.length
  }

  // Rail hover/click for quick create
  const handleRailHover = (e: React.MouseEvent) => {
    if (editingEntry || quickCreate) return
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const y = e.clientY - rect.top
    const pct = Math.max(0, Math.min(1, y / railHeight))
    const totalMins = Math.round(pct * 1440)
    setHoverTime(minutesToTime(totalMins))
  }

  const handleRailClick = () => {
    if (hoverTime && !editingEntry && !quickCreate) {
      quickCreateStartedRef.current = true
      setQuickCreate({ time: hoverTime, event: "", detail: "" })
      setHoverTime(null)
    }
  }

  // Touch handlers for mobile — use refs for native listeners to allow preventDefault
  const isTouchingRef = useRef(false)

  const getTouchTimeFromNative = useCallback((e: TouchEvent): string | null => {
    const rail = railRef.current
    if (!rail) return null
    const rect = rail.getBoundingClientRect()
    const y = e.touches[0].clientY - rect.top
    const h = rail.clientHeight
    if (h <= 0) return null
    const pct = Math.max(0, Math.min(1, y / h))
    return minutesToTime(Math.round(pct * 1440))
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const onTouchStart = (e: TouchEvent) => {
      if (editingEntry || quickCreate) return
      e.preventDefault()
      isTouchingRef.current = true
      setIsTouching(true)
      const time = getTouchTimeFromNative(e)
      if (time) setHoverTime(time)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchingRef.current) return
      e.preventDefault()
      const time = getTouchTimeFromNative(e)
      if (time) setHoverTime(time)
    }
    const onTouchEnd = () => {
      if (!isTouchingRef.current) return
      isTouchingRef.current = false
      setIsTouching(false)
      // Trigger quick create via a callback scheduled in a microtask
      // so we read the latest hoverTime from DOM
      setHoverTime((prev) => {
        if (prev) {
          quickCreateStartedRef.current = true
          setQuickCreate({ time: prev, event: "", detail: "" })
        }
        return null
      })
    }

    rail.addEventListener("touchstart", onTouchStart, { passive: false })
    rail.addEventListener("touchmove", onTouchMove, { passive: false })
    rail.addEventListener("touchend", onTouchEnd)
    rail.addEventListener("touchcancel", onTouchEnd)
    return () => {
      rail.removeEventListener("touchstart", onTouchStart)
      rail.removeEventListener("touchmove", onTouchMove)
      rail.removeEventListener("touchend", onTouchEnd)
      rail.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [editingEntry, quickCreate, getTouchTimeFromNative])

  const currentTimeRailY = isToday ? timeToRailY(currentTime) : -1
  const hoverRailY = hoverTime ? timeToRailY(hoverTime) : -1

  // Quick create form
  const renderQuickCreateForm = (
    ref?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (!quickCreate) return null
    return (
      <div className="rounded-xl border-2 border-primary/30 border-dashed bg-primary/5 p-3 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              ref={quickTimeRef}
              value={quickCreate.time}
              onChange={(e) =>
                setQuickCreate({
                  ...quickCreate,
                  time: formatTimeInput(e.target.value),
                })
              }
              className="w-[80px] text-center font-mono text-sm"
              maxLength={5}
              placeholder="时间"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  ;(ref || quickEventRef)?.current?.focus()
                }
                if (e.key === "Escape") setQuickCreate(null)
              }}
            />
            <Input
              ref={ref || quickEventRef}
              value={quickCreate.event}
              onChange={(e) =>
                setQuickCreate({ ...quickCreate, event: e.target.value })
              }
              className="flex-1 text-sm"
              placeholder="任务类型"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickCreate()
                if (e.key === "Escape") setQuickCreate(null)
              }}
            />
          </div>
          <MarkdownEditor
            value={quickCreate.detail}
            onChange={(v) =>
              setQuickCreate({ ...quickCreate, detail: v })
            }
            placeholder="详情（可选，支持 Markdown）"
            minHeight={80}
          />
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setQuickCreate(null)}
            >
              <X className="h-3.5 w-3.5 mr-1" /> 取消
            </Button>
            <Button
              size="sm"
              onClick={handleQuickCreate}
              disabled={saving || !quickCreate.event.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {saving ? "创建中..." : "创建"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Build SVG ribbons connecting rail time-range segments to cards
  const renderCurves = () => {
    if (railHeight <= 0 || cardPositions.length !== entries.length) return null

    const curveEndX = RAIL_WIDTH + GAP

    return (
      <svg
        ref={curveSvgRef}
        className="absolute top-0 left-0 pointer-events-none z-[6]"
        width={RAIL_WIDTH + GAP}
        height={railHeight}
        style={{ willChange: 'contents' }}
      >
        {entries.map((entry, i) => {
          const color = getCategoryColor(entry.category)
          const durItem = getDurationForEntry(i)

          if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) {
            return (
              <g key={entry.id}>
                <path
                  data-curve-index={i}
                  d=""
                  fill={color}
                  fillOpacity={0.06}
                  stroke={color}
                  strokeWidth={0.5}
                  strokeOpacity={0.15}
                />
              </g>
            )
          }

          return (
            <g key={entry.id}>
              <path
                data-curve-index={i}
                d=""
                fill="none"
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.25}
                strokeDasharray="3 2"
              />
              <circle
                data-circle-index={i}
                cx={curveEndX}
                cy={0}
                r={2}
                fill={color}
                fillOpacity={0.3}
              />
            </g>
          )
        })}
      </svg>
    )
  }

  // ==================== RAIL SVG ====================
  const renderRail = () => {
    if (railHeight <= 0) return null
    const cx = RAIL_LINE_X // Rail line X position

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={RAIL_WIDTH}
        height={railHeight}
      >
        {/* Colored duration segments on rail */}
        {durationItems.map((item, i) => {
          if (item.unknown || !item.start_time || !item.end_time) return null
          const color = getCategoryColor(item.category)

          if (item.cross_day) {
            // Cross-day task: in "end" mode, start_time is from previous day,
            // so on THIS day's rail we render from 00:00 to end_time.
            // In "start" mode, end_time is from next day,
            // so on THIS day's rail we render from start_time to 24:00 (end of day).
            if (timePointMode === "end") {
              const y1 = timeToRailY("00:00")
              const y2 = timeToRailY(formatTime(item.end_time))
              if (y2 <= y1) return null
              return (
                <rect
                  key={`seg-${i}`}
                  x={cx - 4}
                  y={y1}
                  width={8}
                  height={y2 - y1}
                  rx={4}
                  fill={color}
                  fillOpacity={0.45}
                />
              )
            } else {
              const y1 = timeToRailY(formatTime(item.start_time))
              const y2 = timeToRailY("23:59")
              if (y2 <= y1) return null
              return (
                <rect
                  key={`seg-${i}`}
                  x={cx - 4}
                  y={y1}
                  width={8}
                  height={y2 - y1}
                  rx={4}
                  fill={color}
                  fillOpacity={0.45}
                />
              )
            }
          }

          // Normal same-day segment
          const y1 = timeToRailY(formatTime(item.start_time))
          const y2 = timeToRailY(formatTime(item.end_time))
          if (y2 <= y1) return null
          return (
            <rect
              key={`seg-${i}`}
              x={cx - 4}
              y={y1}
              width={8}
              height={y2 - y1}
              rx={4}
              fill={color}
              fillOpacity={0.6}
            />
          )
        })}

        {/* Hour markers — every 2 hours, 0-24 */}
        {HOUR_MARKERS.map((h) => {
          const mins = Math.min(h * 60, 1439)
          const y = RAIL_PADDING + (mins / 1440) * usableHeight
          return (
            <g key={h}>
              <line
                x1={cx - 4}
                y1={y}
                x2={cx + 4}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-muted-foreground/30"
              />
              <text
                x={cx - 7}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground/50"
                fontSize={10}
                fontFamily="monospace"
              >
                {String(h === 24 ? 0 : h).padStart(2, "0")}
              </text>
            </g>
          )
        })}

        {/* Entry dots on rail — only for entries without a known time range */}
        {entries.map((entry, i) => {
          const durItem = getDurationForEntry(i)
          if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) return null
          const dotY = timeToRailY(formatTime(entry.log_time))
          const color = getCategoryColor(entry.category)
          return (
            <circle key={entry.id} cx={cx} cy={dotY} r={3} fill={color} fillOpacity={0.7} />
          )
        })}

        {/* Current time indicator — arrow pointing right toward rail */}
        {isToday && currentTimeRailY >= 0 && (
          <g>
            {/* Right-pointing triangle arrow toward the rail line */}
            <polygon
              points={`${cx - 8} ${currentTimeRailY - 3.5}, ${cx - 8} ${currentTimeRailY + 3.5}, ${cx - 2} ${currentTimeRailY}`}
              className="fill-primary"
            />
            {/* Pulse ring */}
            <circle cx={cx - 5} cy={currentTimeRailY} r={6} className="fill-primary/20">
              <animate
                attributeName="r"
                values="4;8;4"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.4;0;0.4"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Time text on the left */}
            <text
              x={cx - 11}
              y={currentTimeRailY + 4}
              textAnchor="end"
              className="fill-primary"
              fontSize={10}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {currentTime}
            </text>
          </g>
        )}

        {/* Hover / touch indicator */}
        {hoverTime && hoverRailY >= 0 && (
          <g>
            <line
              x1={cx - 4}
              y1={hoverRailY}
              x2={cx + 4}
              y2={hoverRailY}
              stroke="currentColor"
              strokeWidth={isTouching ? 2 : 1}
              strokeDasharray="3 3"
              className="text-muted-foreground/40"
            />
            <circle cx={cx} cy={hoverRailY} r={isTouching ? 5 : 3} className={isTouching ? "fill-primary" : "fill-muted-foreground/50"} />
            {/* Time label — offset above finger on touch */}
            {isTouching ? (
              <>
                <rect
                  x={0}
                  y={Math.max(0, hoverRailY - 55)}
                  width={cx - 2}
                  height={20}
                  rx={4}
                  className="fill-primary"
                />
                <text
                  x={(cx - 2) / 2}
                  y={Math.max(0, hoverRailY - 55) + 14}
                  textAnchor="middle"
                  fill="white"
                  fontSize={13}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {hoverTime}
                </text>
              </>
            ) : (
              <text
                x={cx - 7}
                y={hoverRailY - 5}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={10}
                fontFamily="monospace"
              >
                {hoverTime}
              </text>
            )}
          </g>
        )}
      </svg>
    )
  }

  // ==================== EMPTY STATE ====================
  if (entries.length === 0 && !quickCreate) {
    return (
      <div ref={wrapperRef} className="flex flex-1 min-h-0">
        {/* Fixed rail */}
        <div
          ref={railRef}
          className="relative shrink-0 cursor-crosshair touch-none"
          style={{ width: RAIL_WIDTH }}
          onMouseMove={handleRailHover}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleRailClick}
        >
          {renderRail()}
        </div>

        {/* Cards area */}
        <div className="flex-1 min-w-0 flex items-center justify-center" style={{ marginLeft: GAP }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center text-muted-foreground"
          >
            <CalendarPlus className="w-10 h-10 mb-3 stroke-[1.2]" />
            <p className="text-sm">当前日期暂无生活记录</p>
            <p className="text-xs mt-1">点击左侧时间轴、右上角 + 按钮或使用快捷键创建</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // ==================== MAIN RENDER ====================
  return (
    <div ref={wrapperRef} className="flex flex-1 min-h-0 relative">
      {/* Fixed rail */}
      <div
        ref={railRef}
        className="relative shrink-0 cursor-crosshair touch-none"
        style={{ width: RAIL_WIDTH }}
        onMouseMove={handleRailHover}
        onMouseLeave={() => setHoverTime(null)}
        onClick={handleRailClick}
      >
        {renderRail()}
      </div>

      {/* Curves overlay (connects fixed rail to scrolling cards) */}
      {renderCurves()}

      {/* Scrollable cards area */}
      <div
        ref={cardsScrollRef}
        className="flex-1 min-w-0 overflow-y-auto pt-2 pr-1"
        style={{ marginLeft: GAP, paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AnimatePresence mode="popLayout">
          {entries.map((entry, index) => {
            const isEditing = editingEntry?.id === entry.id
            const color = getCategoryColor(entry.category)
            const durItem = getDurationForEntry(index)
            const insertQuickHere =
              quickCreate && getInsertIndex(quickCreate.time) === index

            return (
              <div key={entry.id}>
                {insertQuickHere && (
                  <motion.div
                    key="quick-create"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2"
                  >
                    {renderQuickCreateForm(quickEventRef)}
                  </motion.div>
                )}

                <motion.div
                  ref={setCardRef(entry.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  transition={{ delay: index * 0.02 }}
                  className="mb-1.5"
                >
                  {isEditing ? (
                    <div className="rounded-xl border-2 border-primary/30 bg-card p-3 shadow-sm">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            value={editingEntry.time}
                            onChange={(e) =>
                              setEditingEntry({
                                ...editingEntry,
                                time: formatTimeInput(e.target.value),
                              })
                            }
                            className="w-[80px] text-center font-mono text-sm"
                            maxLength={5}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                editEventRef.current?.focus()
                              }
                              if (e.key === "Escape") cancelEdit()
                            }}
                          />
                          <Input
                            ref={editEventRef}
                            value={editingEntry.event}
                            onChange={(e) =>
                              setEditingEntry({
                                ...editingEntry,
                                event: e.target.value,
                              })
                            }
                            className="flex-1 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit()
                              if (e.key === "Escape") cancelEdit()
                            }}
                          />
                        </div>
                        <MarkdownEditor
                          value={editingEntry.detail}
                          onChange={(v) =>
                            setEditingEntry({
                              ...editingEntry,
                              detail: v,
                            })
                          }
                          placeholder="详情（可选，支持 Markdown）"
                          minHeight={80}
                        />
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> 取消
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            <Check className="h-3.5 w-3.5 mr-1" /> 保存
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      whileTap={{ scale: 0.99 }}
                      className="group rounded-r-xl border-y border-r border-l-0 px-2.5 py-1.5 shadow-sm hover:brightness-95 transition-all cursor-pointer select-none"
                      style={{ backgroundColor: `${color}10`, borderColor: `${color}20`, WebkitTouchCallout: "none", touchAction: "pan-y" }}
                      onClick={() => handleCardClick(entry)}
                      onContextMenu={(e) => handleCardContextMenu(e, entry)}
                      onTouchStart={(e) => handleCardTouchStart(e, entry)}
                      onTouchMove={handleCardTouchMove}
                      onTouchEnd={handleCardTouchEnd}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {entry.event_type}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium${
                                entry.category === "未分类" ? " cursor-pointer hover:opacity-80 transition-opacity" : ""
                              }`}
                              style={{ backgroundColor: color, color: getContrastText(color) }}
                              onClick={
                                entry.category === "未分类"
                                  ? (e) => {
                                      e.stopPropagation()
                                      setAssignDialog({ open: true, eventType: entry.event_type })
                                    }
                                  : undefined
                              }
                              title={entry.category === "未分类" ? "点击分配分类" : undefined}
                            >
                              {entry.category}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {durItem && !durItem.unknown && durItem.start_time && durItem.end_time
                                ? `${formatTime(durItem.start_time)}~${formatTime(durItem.end_time)}`
                                : `${formatTime(entry.log_time)}(${timePointMode === "end" ? "结束" : "开始"})`}
                            </span>
                            {durItem &&
                              !durItem.unknown &&
                              durItem.duration > 0 && (
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted">
                                  {durItem.display}
                                </span>
                              )}
                            {durItem?.unknown && (
                              <span className="text-[10px] text-muted-foreground/60 italic">
                                {durItem.display}
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
                                  className="overflow-hidden mt-1"
                                >
                                  <div className="text-xs text-muted-foreground prose-compact min-w-0">
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
                                  <div className="text-xs text-muted-foreground prose-compact min-w-0 [&>*]:line-clamp-2">
                                    <MarkdownRenderer content={entry.detail} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:transition-opacity shrink-0">
                          {entry.detail && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailDialog({
                                  title: entry.event_type,
                                  detail: entry.detail,
                                  time: formatTime(entry.log_time),
                                })
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
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(entry)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteRequest(entry.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            )
          })}

          {/* Quick create at end */}
          {quickCreate &&
            getInsertIndex(quickCreate.time) === entries.length && (
              <motion.div
                key="quick-create-end"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2"
              >
                {renderQuickCreateForm()}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Mobile: always show action buttons */}
      <style>{`
        @media (max-width: 640px) {
          .group .opacity-0 { opacity: 1 !important; }
        }
      `}</style>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 min-w-[140px] rounded-xl border bg-popover p-1 shadow-lg"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: "translate(-50%, -100%) translateY(-4px)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {contextMenu.entry.detail && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setDetailDialog({
                    title: contextMenu.entry.event_type,
                    detail: contextMenu.entry.detail,
                    time: formatTime(contextMenu.entry.log_time),
                  })
                  setContextMenu(null)
                }}
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                查看详情
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                startEdit(contextMenu.entry)
                setContextMenu(null)
              }}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              编辑
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                const text = contextMenu.entry.detail
                  ? `${contextMenu.entry.event_type}\n${contextMenu.entry.detail}`
                  : contextMenu.entry.event_type
                navigator.clipboard.writeText(text)
                toast.success("已复制到剪贴板")
                setContextMenu(null)
              }}
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              复制内容
            </button>
            {contextMenu.entry.category === "未分类" && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setAssignDialog({ open: true, eventType: contextMenu.entry.event_type })
                  setContextMenu(null)
                }}
              >
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                分配分类
              </button>
            )}
            <div className="mx-2 my-1 border-t" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => {
                onDeleteRequest(contextMenu.entry.id)
                setContextMenu(null)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail dialog */}
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

      {/* Category assign dialog */}
      <CategoryAssignDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        eventType={assignDialog.eventType}
        onAssigned={() => onUpdate()}
      />
    </div>
  )
}
