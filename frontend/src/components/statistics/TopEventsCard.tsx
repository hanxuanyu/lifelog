import { useState } from "react"
import type { DurationItem } from "@/types"

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

interface TopEventsCardProps {
  items: DurationItem[]
  getCatColor: (name: string, index: number) => string
  limit?: number
  className?: string
}

export function TopEventsCard({ items, getCatColor, limit = 5, className = "" }: TopEventsCardProps) {
  const [expanded, setExpanded] = useState(false)
  const filtered = (items || []).filter((item) => !item.unknown)

  const grouped = new Map<string, { duration: number; category: string }>()
  for (const item of filtered) {
    const existing = grouped.get(item.event_type)
    if (existing) {
      existing.duration += item.duration
    } else {
      grouped.set(item.event_type, { duration: item.duration, category: item.category })
    }
  }

  const ranked = Array.from(grouped.entries())
    .map(([name, { duration, category }]) => ({ name, duration, category }))
    .sort((a, b) => b.duration - a.duration)

  if (ranked.length === 0) return null

  const maxDuration = ranked[0].duration
  const visible = expanded ? ranked : ranked.slice(0, limit)
  const hasMore = ranked.length > limit

  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground mb-2">事项排行</div>
      <div className="space-y-1.5">
        {visible.map((item, i) => (
          <div key={item.name} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground w-4 text-right text-[10px]">{i + 1}</span>
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getCatColor(item.category, i) }}
                />
                <span className="truncate max-w-[140px]">{item.name}</span>
              </div>
              <span className="text-muted-foreground text-[11px]">{formatDuration(item.duration)}</span>
            </div>
            <div className="ml-6 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.duration / maxDuration) * 100}%`,
                  backgroundColor: getCatColor(item.category, i),
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2 py-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : `展开全部 ${ranked.length} 项`}
        </button>
      )}
    </div>
  )
}