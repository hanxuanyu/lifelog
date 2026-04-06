import { PieChart, Pie, Cell } from "recharts"
import type { CategorySummary } from "@/types"

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

interface CompactCategorySummaryProps {
  summary: CategorySummary[]
  totalKnown: string
  subtitle?: string
  getCatColor: (name: string, index: number) => string
  onCategoryClick?: (category: string) => void
}

export function CompactCategorySummary({
  summary,
  totalKnown,
  subtitle,
  getCatColor,
  onCategoryClick,
}: CompactCategorySummaryProps) {
  const data = (summary || []).map((s) => ({
    name: s.category,
    value: durationToHours(s.duration),
  }))

  const hasData = data.length > 0 && data.some((d) => d.value > 0)

  return (
    <div className="flex items-start gap-3">
      {/* Mini donut */}
      <div className="shrink-0 relative" style={{ width: 120, height: 120 }}>
        {hasData ? (
          <>
            <PieChart width={120} height={120}>
              <Pie
                data={data}
                cx={60}
                cy={60}
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={getCatColor(d.name, i)} className="cursor-pointer" onClick={() => onCategoryClick?.(d.name)} />
                ))}
              </Pie>
            </PieChart>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-semibold leading-tight">{totalKnown}</span>
              {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            暂无数据
          </div>
        )}
      </div>

      {/* Category legend list */}
      <div className="flex-1 min-w-0 space-y-1 pt-0.5">
        {(summary || []).map((s, i) => (
          <div
            key={s.category}
            className={`flex items-center justify-between text-xs gap-2 ${onCategoryClick ? "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5" : "py-0.5"}`}
            onClick={() => onCategoryClick?.(s.category)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getCatColor(s.category, i) }}
              />
              <span className="truncate">{s.category}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground shrink-0">
              <span>{s.display}</span>
              <span className="w-10 text-right hidden sm:inline">{s.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
