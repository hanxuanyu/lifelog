import { useState, useEffect, useMemo } from "react"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDailyStats, getWeeklyStats, getMonthlyStats,
  getCategories, getTrendStats,
} from "@/api"
import type {
  DailyStatistics, PeriodStatistics, TrendStatistics,
  Category, DurationItem,
} from "@/types"
import { DateNav } from "@/components/statistics/DateNav"
import { CompactCategorySummary } from "@/components/statistics/CompactCategorySummary"
import { EventBarChart } from "@/components/statistics/EventBarChart"
import { CategoryDetailDialog } from "@/components/statistics/CategoryDetailDialog"
import { TrendChart } from "@/components/statistics/TrendChart"
import { StackedBarChart } from "@/components/statistics/StackedBarChart"
import { TopEventsCard } from "@/components/statistics/TopEventsCard"
import { DailyAveragePills } from "@/components/statistics/DailyAveragePills"
import { AISummaryChat } from "@/components/statistics/AISummaryChat"
import { useTransientPageScrollbar } from "@/hooks/use-transient-page-scrollbar"

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1",
]

export function StatisticsPage() {
  useTransientPageScrollbar()
  const [tab, setTab] = useState<"daily" | "period" | "ai">("daily")
  const [dailyDate, setDailyDate] = useState(new Date())
  const [periodMode, setPeriodMode] = useState<"weekly" | "monthly">("weekly")
  const [periodDate, setPeriodDate] = useState(new Date())
  const [chartView, setChartView] = useState<"distribution" | "trend">("distribution")
  const [dailyData, setDailyData] = useState<DailyStatistics | null>(null)
  const [periodData, setPeriodData] = useState<PeriodStatistics | null>(null)
  const [periodTrend, setPeriodTrend] = useState<TrendStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [catColors, setCatColors] = useState<Record<string, string>>({})
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCategory, setDetailCategory] = useState("")
  const [detailItems, setDetailItems] = useState<DurationItem[]>([])

  useEffect(() => {
    getCategories()
      .then((cats) => {
        const map: Record<string, string> = {}
        ;(cats || []).forEach((c: Category) => {
          if (c.color) map[c.name] = c.color
        })
        setCatColors(map)
      })
      .catch(() => {})
  }, [])

  const getCatColor = (name: string, index: number) =>
    catColors[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]

  // Daily
  useEffect(() => {
    if (tab !== "daily") return
    setLoading(true)
    getDailyStats(format(dailyDate, "yyyy-MM-dd"))
      .then(setDailyData)
      .catch(() => setDailyData(null))
      .finally(() => setLoading(false))
  }, [tab, dailyDate])

  // Period (weekly or monthly) + trend
  useEffect(() => {
    if (tab !== "period") return
    setLoading(true)
    if (periodMode === "weekly") {
      const dateStr = format(periodDate, "yyyy-MM-dd")
      getWeeklyStats(dateStr)
        .then((data) => {
          setPeriodData(data)
          if (data?.start_date && data?.end_date) {
            getTrendStats(data.start_date, data.end_date)
              .then(setPeriodTrend)
              .catch(() => setPeriodTrend(null))
          }
        })
        .catch(() => { setPeriodData(null); setPeriodTrend(null) })
        .finally(() => setLoading(false))
    } else {
      const year = periodDate.getFullYear()
      const month = periodDate.getMonth() + 1
      getMonthlyStats(year, month)
        .then((data) => {
          setPeriodData(data)
          if (data?.start_date && data?.end_date) {
            getTrendStats(data.start_date, data.end_date)
              .then(setPeriodTrend)
              .catch(() => setPeriodTrend(null))
          }
        })
        .catch(() => { setPeriodData(null); setPeriodTrend(null) })
        .finally(() => setLoading(false))
    }
  }, [tab, periodDate, periodMode])


  const collectCategories = (days: { summary: { category: string }[] }[]) => {
    const set = new Set<string>()
    for (const day of days) {
      for (const s of day.summary) set.add(s.category)
    }
    return Array.from(set)
  }

  const periodTrendCategories = useMemo(
    () => collectCategories(periodTrend?.days || []),
    [periodTrend]
  )

  const openCategoryDetail = (category: string, items: DurationItem[]) => {
    setDetailCategory(category)
    setDetailItems(items)
    setDetailOpen(true)
  }

  const detailColor = getCatColor(detailCategory, 0)

  // Period date navigation helpers
  const periodPrev = () => {
    if (periodMode === "weekly") {
      setPeriodDate((d) => subDays(d, 7))
    } else {
      setPeriodDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    }
  }
  const periodNext = () => {
    if (periodMode === "weekly") {
      setPeriodDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    } else {
      setPeriodDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    }
  }
  const periodLabel = periodData
    ? `${periodData.start_date} ~ ${periodData.end_date}`
    : periodMode === "weekly"
      ? format(periodDate, "yyyy年 第w周", { locale: zhCN })
      : format(periodDate, "yyyy年M月", { locale: zhCN })


  const pillToggle = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`

  return (
    <div>
      <div className="fixed top-0 left-0 right-0 z-40 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-4 w-full pt-4 pb-3">
          <div>
            <h1 className="text-lg font-semibold">数据统计</h1>
          </div>
        </div>
      </div>
      <div className="pt-14" />
      <div className="max-w-5xl mx-auto px-4 w-full">
        <div style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="daily" className="flex-1">日统计</TabsTrigger>
              <TabsTrigger value="period" className="flex-1">周期统计</TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">AI 总结</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Daily Tab */}
                  <TabsContent value="daily" className="mt-0 space-y-3">
                    <DateNav
                      onPrev={() => setDailyDate((d) => subDays(d, 1))}
                      onNext={() => setDailyDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
                      label={format(dailyDate, "yyyy年M月d日", { locale: zhCN })}
                    />
                    {dailyData ? (
                      <>
                        <CompactCategorySummary
                          summary={dailyData.summary}
                          totalKnown={dailyData.total_known}
                          getCatColor={getCatColor}
                          onCategoryClick={(cat) => openCategoryDetail(cat, dailyData.items)}
                        />
                        <EventBarChart items={dailyData.items} getCatColor={getCatColor} />
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                    )}
                  </TabsContent>

                  {/* Period Tab */}
                  <TabsContent value="period" className="mt-0 space-y-3">
                    {/* Mode toggle + DateNav on same row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button className={pillToggle(periodMode === "weekly")} onClick={() => setPeriodMode("weekly")}>按周</button>
                        <button className={pillToggle(periodMode === "monthly")} onClick={() => setPeriodMode("monthly")}>按月</button>
                      </div>
                      <DateNav onPrev={periodPrev} onNext={periodNext} label={periodLabel} className="flex items-center gap-1" />
                    </div>
                    {periodData ? (
                      <>
                        <CompactCategorySummary
                          summary={periodData.summary}
                          totalKnown={periodData.total_known}
                          subtitle={`共 ${periodData.day_count} 天`}
                          getCatColor={getCatColor}
                          onCategoryClick={(cat) => openCategoryDetail(cat, periodData.items || [])}
                        />

                        {/* Chart toggle + chart */}
                        {periodTrend && periodTrend.days.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <button className={pillToggle(chartView === "distribution")} onClick={() => setChartView("distribution")}>分布</button>
                              <button className={pillToggle(chartView === "trend")} onClick={() => setChartView("trend")}>趋势</button>
                            </div>
                            {chartView === "distribution" ? (
                              <StackedBarChart days={periodTrend.days} categories={periodTrendCategories} getCatColor={getCatColor} />
                            ) : (
                              <TrendChart days={periodTrend.days} categories={periodTrendCategories} getCatColor={getCatColor} />
                            )}
                            <DailyAveragePills days={periodTrend.days} getCatColor={getCatColor} />
                          </div>
                        )}

                        {periodData.items && periodData.items.length > 0 && (
                          <TopEventsCard items={periodData.items} getCatColor={getCatColor} />
                        )}
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                    )}
                  </TabsContent>

                  {/* AI Summary Tab */}
                  <TabsContent value="ai" className="mt-0 h-[calc(100dvh-10.5rem)] min-h-[420px] overflow-hidden">
                    <AISummaryChat />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>

          <CategoryDetailDialog
            open={detailOpen}
            onOpenChange={setDetailOpen}
            category={detailCategory}
            items={detailItems}
            color={detailColor}
          />
        </div>
      </div>
    </div>
  )
}
