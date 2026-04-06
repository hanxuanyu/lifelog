import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import type { DurationItem } from "@/types"

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

interface EventBarChartProps {
  items: DurationItem[]
  getCatColor: (name: string, index: number) => string
  className?: string
}

export function EventBarChart({ items, getCatColor, className = "" }: EventBarChartProps) {
  const filtered = (items || []).filter((item) => !item.unknown)
  if (filtered.length === 0) {
    return <p className="text-center text-muted-foreground py-6 text-xs">暂无事项数据</p>
  }
  const data = filtered.map((item) => ({
    name: item.event_type.length > 6 ? item.event_type.slice(0, 6) + "\u2026" : item.event_type,
    fullName: item.event_type,
    hours: durationToHours(item.duration),
    category: item.category,
    display: item.display,
  }))
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground mb-2">事项时长</div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" unit="h" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, _, props) => [
              (props as any).payload?.display || `${value}h`,
              (props as any).payload?.fullName || "",
            ]}
          />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={getCatColor(d.category, i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}