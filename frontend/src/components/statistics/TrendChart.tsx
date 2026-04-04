import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayBreakdown } from "@/types"

interface TrendChartProps {
  days: DayBreakdown[]
  categories: string[]
  getCatColor: (name: string, index: number) => string
}

export function TrendChart({ days, categories, getCatColor }: TrendChartProps) {
  if (!days || days.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8 text-sm">暂无数据</p>
        </CardContent>
      </Card>
    )
  }

  const data = days.map((day) => {
    const row: Record<string, any> = { date: day.date.slice(5) }
    for (const s of day.summary) {
      row[s.category] = Math.round((s.duration / 3600) * 10) / 10
    }
    return row
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">每日趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis unit="h" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${value}h`]} />
            <Legend />
            {categories.map((cat, i) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="1"
                stroke={getCatColor(cat, i)}
                fill={getCatColor(cat, i)}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}