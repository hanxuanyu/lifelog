import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CategorySummary } from "@/types"

interface SummaryListProps {
  summary: CategorySummary[]
  totalKnown: string
  getCatColor: (name: string, index: number) => string
  onCategoryClick?: (category: string) => void
}

export function SummaryList({ summary, totalKnown, getCatColor, onCategoryClick }: SummaryListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">汇总</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {summary?.map((s, i) => (
            <motion.div
              key={s.category}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center justify-between ${onCategoryClick ? "cursor-pointer hover:bg-muted/50 rounded-md px-1 -mx-1 py-0.5" : ""}`}
              onClick={() => onCategoryClick?.(s.category)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: getCatColor(s.category, i) }}
                />
                <span className="text-sm">{s.category}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{s.display}</span>
                <span className="w-12 text-right">{s.percentage.toFixed(1)}%</span>
              </div>
            </motion.div>
          ))}
          {totalKnown && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm font-medium">
                <span>有效统计</span>
                <span>{totalKnown}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
