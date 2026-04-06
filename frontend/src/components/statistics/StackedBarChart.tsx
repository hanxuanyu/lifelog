import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { DayBreakdown } from "@/types"

interface StackedBarChartProps {
  days: DayBreakdown[]
  categories: string[]
  getCatColor: (name: string, index: number) => string
  className?: string
}

export function StackedBarChart({ days, categories, getCatColor, className = "" }: StackedBarChartProps) {
  if (!days || days.length === 0) {
    return <p className="text-center text-muted-foreground py-6 text-xs">暂无数据</p>
  }

  const data = days.map((day) => {
    const row: Record<string, any> = { date: day.date.slice(5) }
    for (const s of day.summary) {
      row[s.category] = Math.round((s.duration / 3600) * 10) / 10
    }
    return row
  })

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis unit="h" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${value}h`]} />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="stack"
              fill={getCatColor(cat, i)}
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}