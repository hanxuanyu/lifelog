import type { LogEntry, DurationItem, CrossDayHint } from "@/types"
import { RAIL_WIDTH, GAP } from "./shared"

interface CurveSvgProps {
  svgRef: React.RefObject<SVGSVGElement | null>
  railHeight: number
  entries: LogEntry[]
  crossDayHints: CrossDayHint[]
  getCategoryColor: (category: string) => string
  getDurationForEntry: (index: number) => DurationItem | null
  highlightIndex: number | null
}

export function CurveSvg({
  svgRef, railHeight, entries, crossDayHints,
  getCategoryColor, getDurationForEntry, highlightIndex,
}: CurveSvgProps) {
  if (railHeight <= 0) return null
  const curveEndX = RAIL_WIDTH + GAP

  return (
    <svg ref={svgRef} className="absolute top-0 left-0 pointer-events-none z-[6]"
      width={RAIL_WIDTH + GAP} height={railHeight} style={{ willChange: 'contents' }}>
      {entries.map((entry, i) => {
        const color = getCategoryColor(entry.category)
        const durItem = getDurationForEntry(i)
        const isHl = highlightIndex === i

        if (durItem && !durItem.unknown && durItem.start_time && durItem.end_time) {
          return (
            <g key={entry.id}>
              <path data-curve-index={i} d="" fill={color}
                fillOpacity={isHl ? 0.20 : 0.10} stroke="none"
                style={{ transition: "fill-opacity 0.15s" }} />
            </g>
          )
        }

        return (
          <g key={entry.id}>
            <path data-curve-index={i} d="" fill="none" stroke={color}
              strokeWidth={isHl ? 1.5 : 1} strokeOpacity={isHl ? 0.5 : 0.3}
              strokeDasharray="3 2" style={{ transition: "stroke-opacity 0.15s, stroke-width 0.15s" }} />
            <circle data-circle-index={i} cx={curveEndX} cy={0}
              r={isHl ? 3 : 2} fill={color} fillOpacity={isHl ? 0.6 : 0.35}
              style={{ transition: "fill-opacity 0.15s" }} />
          </g>
        )
      })}
      {crossDayHints.map((hint, i) => {
        const color = getCategoryColor(hint.category)
        const key = `${hint.direction}-${i}`
        return (
          <g key={`ghost-curve-${key}`}>
            <path data-ghost-curve-key={key} d="" fill={color} fillOpacity={0.06}
              stroke={color} strokeWidth={1} strokeOpacity={0.2} strokeDasharray="4 3" />
          </g>
        )
      })}
    </svg>
  )
}
