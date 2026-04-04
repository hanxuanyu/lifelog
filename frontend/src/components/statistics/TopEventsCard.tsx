import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
}

export function TopEventsCard({ items, getCatColor, limit = 10 }: TopEventsCardProps) {
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
    .slice(0, limit)

  if (ranked.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">事项排行</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8 text-sm">暂无数据</p>
        </CardContent>
      </Card>
    )
  }

  const maxDuration = ranked[0].duration

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">事项排行</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ranked.map((item, i) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-5 text-right text-xs">{i + 1}</span>
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getCatColor(item.category, i) }}
                  />
                  <span className="truncate max-w-[140px]">{item.name}</span>
                </div>
                <span className="text-muted-foreground text-xs">{formatDuration(item.duration)}</span>
              </div>
              <div className="ml-7 h-1.5 rounded-full bg-muted overflow-hidden">
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
      </CardContent>
    </Card>
  )
}