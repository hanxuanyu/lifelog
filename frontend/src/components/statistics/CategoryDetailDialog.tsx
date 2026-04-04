import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import type { DurationItem } from "@/types"

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

interface CategoryDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: string
  items: DurationItem[]
  color: string
}

export function CategoryDetailDialog({
  open, onOpenChange, category, items, color,
}: CategoryDetailDialogProps) {
  const categoryItems = items.filter(
    (item) => item.category === category && !item.unknown
  )

  const grouped = new Map<string, number>()
  for (const item of categoryItems) {
    grouped.set(item.event_type, (grouped.get(item.event_type) || 0) + item.duration)
  }

  const data = Array.from(grouped.entries())
    .map(([name, duration]) => ({
      name: name.length > 8 ? name.slice(0, 8) + "\u2026" : name,
      fullName: name,
      hours: durationToHours(duration),
      display: formatDuration(duration),
    }))
    .sort((a, b) => b.hours - a.hours)

  const totalSeconds = categoryItems.reduce((sum, item) => sum + item.duration, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {category}
            <span className="text-sm text-muted-foreground font-normal">
              {formatDuration(totalSeconds)}
            </span>
          </DialogTitle>
        </DialogHeader>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">暂无数据</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {data.map((d) => (
                <div key={d.fullName} className="flex items-center justify-between text-sm">
                  <span>{d.fullName}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{d.display}</span>
                    <span className="w-12 text-right">
                      {totalSeconds > 0 ? ((d.hours / durationToHours(totalSeconds)) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {data.length > 1 && (
              <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
                <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" unit="h" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, _, props) => [(props as any).payload?.display || `${value}h`, (props as any).payload?.fullName || ""]} />
                  <Bar dataKey="hours" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}