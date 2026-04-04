import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CategorySummary } from "@/types"

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

interface PieChartCardProps {
  title: string
  subtitle?: string
  summary: CategorySummary[]
  getCatColor: (name: string, index: number) => string
  onCategoryClick?: (category: string) => void
}

export function PieChartCard({
  title, subtitle, summary, getCatColor, onCategoryClick,
}: PieChartCardProps) {
  if (!summary || summary.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8 text-sm">
            暂无数据
          </p>
        </CardContent>
      </Card>
    )
  }
  const data = summary.map((s) => ({
    name: s.category,
    value: durationToHours(s.duration),
    percentage: s.percentage,
    display: s.display,
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {title}
          {subtitle && (
            <span className="text-xs text-muted-foreground ml-2">
              {subtitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              onClick={(_, index) => onCategoryClick?.(summary[index].category)}
              className={onCategoryClick ? "cursor-pointer" : ""}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={getCatColor(d.name, i)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [
                `${(props as any).payload?.display || value + "h"} (${(props as any).payload?.percentage?.toFixed(1)}%)`,
                name as string,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}