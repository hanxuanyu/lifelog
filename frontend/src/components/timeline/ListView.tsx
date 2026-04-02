import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Check, X, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateLog, createLog } from "@/api"
import type { LogEntry, DurationItem } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  type EditState,
  type QuickCreateState,
  formatTime,
  formatTimeInput,
  timeToMinutes,
  minutesToTime,
} from "./shared"

// Layout constants
const RAIL_WIDTH = 48 // Fixed rail column width (wider for left-side labels)
const GAP = 8 // Gap between rail and cards
const RAIL_PADDING = 12 // Top/bottom padding so dots aren't clipped
const RAIL_LINE_X = 36 // X position of the rail line (right side, leaving space for labels)

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
  const [saving, setSaving] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [railHeight, setRailHeight] = useState(0)
  const [cardYPositions, setCardYPositions] = useState<number[]>([])

  const wrapperRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const cardsScrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const editEventRef = useRef<HTMLInputElement>(null)
  const quickEventRef = useRef<HTMLInputElement>(null)
  const editStartedRef = useRef(false)

  // Focus management
  useEffect(() => {
    if (editingEntry && editStartedRef.current) {
      editStartedRef.current = false
      setTimeout(() => editEventRef.current?.focus(), 50)
    }
  }, [editingEntry])

  useEffect(() => {
    if (quickCreate) {
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

  // Track scroll position
  useEffect(() => {
    const el = cardsScrollRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // Measure card Y positions (relative to scroll container)
  const measurePositions = useCallback(() => {
    const scrollEl = cardsScrollRef.current
    if (!scrollEl) return
    const positions: number[] = entries.map((entry) => {
      const el = cardRefs.current.get(entry.id)
      if (!el) return 0
      // Position relative to scroll container top
      return el.offsetTop + el.offsetHeight / 2
    })
    setCardYPositions(positions)
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

  // Time to Y position on rail (proportional to full day, with padding)
  const usableHeight = Math.max(0, railHeight - RAIL_PADDING * 2)
  const timeToRailY = useCallback(
    (timeStr: string): number => {
      return RAIL_PADDING + (timeToMinutes(timeStr) / 1440) * usableHeight
    },
    [usableHeight]
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

  const saveEdit = async () => {
    if (!editingEntry) return
    try {
      await updateLog(editingEntry.id, {
        log_time: editingEntry.time,
        event_type: editingEntry.event,
        detail: editingEntry.detail || undefined,
      })
      toast({ title: "更新成功" })
      setEditingEntry(null)
      onUpdate()
    } catch {
      toast({ title: "更新失败", variant: "destructive" })
    }
  }

  const handleQuickCreate = async () => {
    if (!quickCreate || !quickCreate.event.trim()) return
    setSaving(true)
    try {
      await createLog({
        log_date: date,
        log_time: quickCreate.time,
        event_type: quickCreate.event.trim(),
        detail: quickCreate.detail || undefined,
      })
      toast({ title: "创建成功" })
      setQuickCreate(null)
      onUpdate()
    } catch {
      toast({ title: "创建失败", variant: "destructive" })
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
      setQuickCreate({ time: hoverTime, event: "", detail: "" })
      setHoverTime(null)
    }
  }

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
          <Input
            value={quickCreate.detail}
            onChange={(e) =>
              setQuickCreate({ ...quickCreate, detail: e.target.value })
            }
            placeholder="详情（可选）"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickCreate()
              if (e.key === "Escape") setQuickCreate(null)
            }}
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

  // Build SVG curves connecting rail dots to cards
  const renderCurves = () => {
    if (railHeight <= 0 || cardYPositions.length !== entries.length) return null

    // The rail is fixed, the cards scroll.
    // Rail dot Y is in rail coordinate space.
    // Card Y is relative to scroll container content, so visible Y = cardY - scrollTop.
    // We draw the SVG in the wrapper's coordinate space where rail starts at left edge.
    const railCenterX = RAIL_LINE_X
    const curveEndX = RAIL_WIDTH + GAP

    return (
      <svg
        className="absolute top-0 left-0 pointer-events-none z-[6]"
        width={RAIL_WIDTH + GAP}
        height={railHeight}
      >
        {entries.map((entry, i) => {
          const dotY = timeToRailY(formatTime(entry.log_time))
          // Card center Y in the visible viewport = cardY - scrollTop
          const cardVisibleY = cardYPositions[i] - scrollTop
          const color = getCategoryColor(entry.category)

          // Control points for smooth bezier
          const cpX = railCenterX + (curveEndX - railCenterX) * 0.6
          const path = `M ${railCenterX} ${dotY} C ${cpX} ${dotY}, ${cpX} ${cardVisibleY}, ${curveEndX} ${cardVisibleY}`

          return (
            <g key={entry.id}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.3}
              />
              {/* Small connector dot at card end */}
              <circle
                cx={curveEndX}
                cy={cardVisibleY}
                r={2}
                fill={color}
                fillOpacity={0.4}
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
        {/* Main rail line */}
        <line
          x1={cx}
          y1={RAIL_PADDING}
          x2={cx}
          y2={railHeight - RAIL_PADDING}
          stroke="currentColor"
          strokeWidth={2}
          className="text-border"
          strokeLinecap="round"
        />

        {/* Colored duration segments on rail */}
        {durationItems.map((item, i) => {
          if (item.unknown || !item.start_time || !item.end_time) return null
          const y1 = timeToRailY(formatTime(item.start_time))
          const y2 = timeToRailY(formatTime(item.end_time))
          if (y2 <= y1) return null
          const color = getCategoryColor(item.category)
          return (
            <rect
              key={`seg-${i}`}
              x={cx - 3}
              y={y1}
              width={6}
              height={y2 - y1}
              rx={3}
              fill={color}
              fillOpacity={0.5}
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
                x1={cx - 3}
                y1={y}
                x2={cx + 3}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-muted-foreground/30"
              />
              <text
                x={cx - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground/40"
                fontSize={7}
                fontFamily="monospace"
              >
                {String(h === 24 ? 0 : h).padStart(2, "0")}
              </text>
            </g>
          )
        })}

        {/* Entry dots on rail */}
        {entries.map((entry) => {
          const dotY = timeToRailY(formatTime(entry.log_time))
          const color = getCategoryColor(entry.category)
          return (
            <circle key={entry.id} cx={cx} cy={dotY} r={4} fill={color} />
          )
        })}

        {/* Current time indicator — left-side arrow + text */}
        {isToday && currentTimeRailY >= 0 && (
          <g>
            {/* Right-pointing arrow on the left side of rail */}
            <polygon
              points={`${cx - 8} ${currentTimeRailY}, ${cx - 2} ${currentTimeRailY - 3.5}, ${cx - 2} ${currentTimeRailY + 3.5}`}
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
              x={cx - 10}
              y={currentTimeRailY - 4}
              textAnchor="end"
              className="fill-primary"
              fontSize={7}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {currentTime}
            </text>
          </g>
        )}

        {/* Hover indicator */}
        {hoverTime && hoverRailY >= 0 && (
          <g>
            <line
              x1={cx - 3}
              y1={hoverRailY}
              x2={cx + 3}
              y2={hoverRailY}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              className="text-muted-foreground/40"
            />
            <circle cx={cx} cy={hoverRailY} r={3} className="fill-muted-foreground/50" />
            <text
              x={cx - 6}
              y={hoverRailY - 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={7}
              fontFamily="monospace"
            >
              {hoverTime}
            </text>
          </g>
        )}
      </svg>
    )
  }

  // ==================== EMPTY STATE ====================
  if (entries.length === 0 && !quickCreate) {
    return (
      <div ref={wrapperRef} className="flex h-full">
        {/* Fixed rail */}
        <div
          ref={railRef}
          className="relative shrink-0 cursor-crosshair"
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
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">今天还没有记录</p>
            <p className="text-xs mt-1">点击时间轴创建记录，或在上方输入</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // ==================== MAIN RENDER ====================
  return (
    <div ref={wrapperRef} className="flex h-full relative">
      {/* Fixed rail */}
      <div
        ref={railRef}
        className="relative shrink-0 cursor-crosshair"
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
        className="flex-1 min-w-0 overflow-y-auto py-2 pr-1"
        style={{ marginLeft: GAP }}
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
                  className="mb-2"
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
                        <Input
                          value={editingEntry.detail}
                          onChange={(e) =>
                            setEditingEntry({
                              ...editingEntry,
                              detail: e.target.value,
                            })
                          }
                          placeholder="详情（可选）"
                          className="text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit()
                            if (e.key === "Escape") cancelEdit()
                          }}
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
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="group rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-default"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {entry.event_type}
                            </span>
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: color }}
                            >
                              {entry.category}
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
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground/70">
                              {formatTime(entry.log_time)}
                            </span>
                          </div>
                          {entry.detail && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {entry.detail}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:transition-opacity shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDeleteRequest(entry.id)}
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
    </div>
  )
}
