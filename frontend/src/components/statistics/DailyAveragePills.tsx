import type { DayBreakdown } from "@/types"

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

interface DailyAveragePillsProps {
  days: DayBreakdown[]
  getCatColor: (name: string, index: number) => string
}

export function DailyAveragePills({ days, getCatColor }: DailyAveragePillsProps) {
  if (!days || days.length === 0) return null

  const catTotals = new Map<string, number>()
  for (const day of days) {
    for (const s of day.summary) {
      catTotals.set(s.category, (catTotals.get(s.category) || 0) + s.duration)
    }
  }

  const dayCount = days.length
  const averages = Array.from(catTotals.entries())
    .map(([category, total]) => ({
      category,
      avgSeconds: Math.round(total / dayCount),
    }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds)

  if (averages.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      <span className="text-[10px] text-muted-foreground/60 self-center mr-0.5">日均</span>
      {averages.map((item, i) => (
        <span
          key={item.category}
          className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px]"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: getCatColor(item.category, i) }}
          />
          <span className="text-muted-foreground">{item.category}</span>
          <span className="font-medium">{formatDuration(item.avgSeconds)}</span>
        </span>
      ))}
    </div>
  )
}
