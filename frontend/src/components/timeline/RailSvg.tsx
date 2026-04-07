import type { LogEntry, DurationItem, CrossDayHint } from "@/types"
import { formatTime, RAIL_WIDTH, RAIL_PADDING, RAIL_LINE_X, HOUR_MARKERS } from "./shared"

interface RailSvgProps {
  railHeight: number
  usableHeight: number
  timeToRailY: (timeStr: string) => number
  durationItems: DurationItem[]
  entries: LogEntry[]
  crossDayHints: CrossDayHint[]
  getCategoryColor: (category: string) => string
  getDurationForEntry: (index: number) => DurationItem | null
  getEntryMode: (entry: LogEntry) => string
  durationToEntryMap: Map<number, number>
  highlightIndex: number | null
  highlightSourceRef: React.MutableRefObject<"rail" | "card" | null>
  setHighlightIndex: (index: number | null) => void
  isToday: boolean
  currentTimeRailY: number
  hoverTime: string | null
  hoverRailY: number
  isTouching: boolean
  timePointMode: string
  currentTime: string
}

export function RailSvg({
  railHeight, usableHeight, timeToRailY, durationItems, entries, crossDayHints,
  getCategoryColor, getDurationForEntry, getEntryMode, durationToEntryMap,
  highlightIndex, highlightSourceRef, setHighlightIndex,
  isToday, currentTimeRailY, hoverTime, hoverRailY, isTouching, timePointMode, currentTime,
}: RailSvgProps) {
  if (railHeight <= 0) return null
  const cx = RAIL_LINE_X

  return (
    <svg className="absolute inset-0 pointer-events-none" width={RAIL_WIDTH} height={railHeight}>
      {/* Duration segments */}
      {durationItems.map((item, i) => {
        if (item.unknown || !item.start_time || !item.end_time) return null
        const color = getCategoryColor(item.category)
        const entryIdx = durationToEntryMap.get(i)
        const isHl = entryIdx !== undefined && highlightIndex === entryIdx
        const segHover = {
          pointerEvents: "auto" as const, cursor: "pointer" as const,
          onMouseEnter: () => { if (entryIdx !== undefined) { highlightSourceRef.current = "rail"; setHighlightIndex(entryIdx) } },
          onMouseLeave: () => { if (highlightSourceRef.current === "rail") setHighlightIndex(null) },
        }

        if (item.cross_day) {
          const entryMode = item.time_point_mode || (entryIdx !== undefined ? getEntryMode(entries[entryIdx]) : timePointMode)
          const y1 = entryMode === "end" ? timeToRailY("00:00") : timeToRailY(formatTime(item.start_time))
          const y2 = entryMode === "end" ? timeToRailY(formatTime(item.end_time)) : timeToRailY("23:59")
          if (y2 <= y1) return null
          return (
            <rect key={`seg-${i}`} x={cx - 4} y={y1} width={8} height={y2 - y1} rx={4}
              fill={color} fillOpacity={isHl ? 0.85 : 0.45}
              stroke={isHl ? color : "none"} strokeWidth={isHl ? 1.5 : 0} strokeOpacity={0.8}
              style={{ transition: "fill-opacity 0.15s, stroke-width 0.15s" }} {...segHover} />
          )
        }

        const y1 = timeToRailY(formatTime(item.start_time))
        const y2 = timeToRailY(formatTime(item.end_time))
        if (y2 <= y1) return null
        return (
          <rect key={`seg-${i}`} x={cx - 4} y={y1} width={8} height={y2 - y1} rx={4}
            fill={color} fillOpacity={isHl ? 0.9 : 0.6}
            stroke={isHl ? color : "none"} strokeWidth={isHl ? 1.5 : 0} strokeOpacity={0.8}
            style={{ transition: "fill-opacity 0.15s, stroke-width 0.15s" }} {...segHover} />
        )
      })}

      {/* Cross-day ghost segments */}
      {crossDayHints.map((hint, i) => {
        const color = getCategoryColor(hint.category)
        const y1 = timeToRailY(formatTime(hint.start_time))
        const y2 = timeToRailY(formatTime(hint.end_time))
        if (y2 <= y1) return null
        return (
          <rect key={`ghost-seg-${i}`} x={cx - 4} y={y1} width={8} height={y2 - y1} rx={4}
            fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3 2" />
        )
      })}

      {/* Hour markers */}
      {HOUR_MARKERS.map((h) => {
        const mins = Math.min(h * 60, 1439)
        const y = RAIL_PADDING + (mins / 1440) * usableHeight
        return (
          <g key={h}>
            <line x1={cx - 4} y1={y} x2={cx + 4} y2={y} stroke="currentColor" strokeWidth={1} className="text-muted-foreground/30" />
            <text x={cx - 7} y={y + 4} textAnchor="end" className="fill-muted-foreground/50" fontSize={10} fontFamily="monospace">
              {String(h === 24 ? 0 : h).padStart(2, "0")}
            </text>
          </g>
        )
      })}

      {/* Entry dots */}
      {entries.map((entry, i) => {
        const durItem = getDurationForEntry(i)
        if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) return null
        const dotY = timeToRailY(formatTime(entry.log_time))
        const color = getCategoryColor(entry.category)
        const isHl = highlightIndex === i
        return (
          <circle key={entry.id} cx={cx} cy={dotY} r={isHl ? 5 : 3}
            fill={color} fillOpacity={isHl ? 1 : 0.7}
            stroke={isHl ? color : "none"} strokeWidth={isHl ? 2 : 0} strokeOpacity={0.4}
            pointerEvents="auto" cursor="pointer" style={{ transition: "r 0.15s, fill-opacity 0.15s" }}
            onMouseEnter={() => { highlightSourceRef.current = "rail"; setHighlightIndex(i) }}
            onMouseLeave={() => { if (highlightSourceRef.current === "rail") setHighlightIndex(null) }} />
        )
      })}

      {/* Current time indicator */}
      {isToday && currentTimeRailY >= 0 && (
        <g>
          <polygon points={`${cx - 8} ${currentTimeRailY - 3.5}, ${cx - 8} ${currentTimeRailY + 3.5}, ${cx - 2} ${currentTimeRailY}`} className="fill-primary" />
          <circle cx={cx - 5} cy={currentTimeRailY} r={6} className="fill-primary/20">
            <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x={cx - 11} y={currentTimeRailY + 4} textAnchor="end" className="fill-primary" fontSize={10} fontFamily="monospace" fontWeight="bold">
            {currentTime}
          </text>
        </g>
      )}

      {/* Hover / touch indicator */}
      {hoverTime && hoverRailY >= 0 && (
        <g>
          <line x1={cx - 4} y1={hoverRailY} x2={cx + 4} y2={hoverRailY}
            stroke="currentColor" strokeWidth={isTouching ? 2 : 1} strokeDasharray="3 3" className="text-muted-foreground/40" />
          <circle cx={cx} cy={hoverRailY} r={isTouching ? 5 : 3} className={isTouching ? "fill-primary" : "fill-muted-foreground/50"} />
          {isTouching ? (
            <>
              <rect x={0} y={Math.max(0, hoverRailY - 55)} width={cx - 2} height={20} rx={4} className="fill-primary" />
              <text x={(cx - 2) / 2} y={Math.max(0, hoverRailY - 55) + 14} textAnchor="middle" fill="white" fontSize={13} fontFamily="monospace" fontWeight="bold">
                {hoverTime}
              </text>
            </>
          ) : (
            <text x={cx - 7} y={hoverRailY - 5} textAnchor="end" className="fill-muted-foreground" fontSize={10} fontFamily="monospace">
              {hoverTime}
            </text>
          )}
        </g>
      )}
    </svg>
  )
}
