import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayBreakdown } from "@/types"

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

interface DailyAverageCardProps {
  days: DayBreakdown[]
  getCatColor: (name: string, index: number) => string
}

export function DailyAverageCard({ days, getCatColor }: DailyAverageCardProps) {
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          日均统计
          <span className="text-xs text-muted-foreground ml-2">共 {dayCount} 天</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {averages.map((item, i) => (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: getCatColor(item.category, i) }}
                />
                <span>{item.category}</span>
              </div>
              <span className="text-muted-foreground">{formatDuration(item.avgSeconds)}/天</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
