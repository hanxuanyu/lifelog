import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DurationItem } from "@/types"

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

interface EventBarChartProps {
  items: DurationItem[]
  getCatColor: (name: string, index: number) => string
}

export function EventBarChart({ items, getCatColor }: EventBarChartProps) {
  const filtered = (items || []).filter((item) => !item.unknown)
  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">事项时长</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8 text-sm">暂无数据</p>
        </CardContent>
      </Card>
    )
  }
  const data = filtered.map((item) => ({
    name: item.event_type.length > 6 ? item.event_type.slice(0, 6) + "\u2026" : item.event_type,
    fullName: item.event_type,
    hours: durationToHours(item.duration),
    category: item.category,
    display: item.display,
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">事项时长</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" unit="h" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
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
      </CardContent>
    </Card>
  )
}