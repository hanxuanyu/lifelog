import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
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
import { PieChartCard } from "@/components/statistics/PieChartCard"
import { SummaryList } from "@/components/statistics/SummaryList"
import { EventBarChart } from "@/components/statistics/EventBarChart"
import { CategoryDetailDialog } from "@/components/statistics/CategoryDetailDialog"
import { TrendChart } from "@/components/statistics/TrendChart"
import { StackedBarChart } from "@/components/statistics/StackedBarChart"
import { TopEventsCard } from "@/components/statistics/TopEventsCard"
import { DailyAverageCard } from "@/components/statistics/DailyAverageCard"

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1",
]

export function StatisticsPage() {
  const [tab, setTab] = useState("daily")
  const [dailyDate, setDailyDate] = useState(new Date())
  const [weeklyDate, setWeeklyDate] = useState(new Date())
  const [monthYear, setMonthYear] = useState(new Date().getFullYear())
  const [monthMonth, setMonthMonth] = useState(new Date().getMonth() + 1)
  const [dailyData, setDailyData] = useState<DailyStatistics | null>(null)
  const [weeklyData, setWeeklyData] = useState<PeriodStatistics | null>(null)
  const [monthlyData, setMonthlyData] = useState<PeriodStatistics | null>(null)
  const [weeklyTrend, setWeeklyTrend] = useState<TrendStatistics | null>(null)
  const [monthlyTrend, setMonthlyTrend] = useState<TrendStatistics | null>(null)
  const [trendMode, setTrendMode] = useState<"weekly" | "monthly">("weekly")
  const [trendDate, setTrendDate] = useState(new Date())
  const [trendData, setTrendData] = useState<TrendStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [catColors, setCatColors] = useState<Record<string, string>>({})
  // PLACEHOLDER_DETAIL_STATE
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

  // Weekly + trend
  useEffect(() => {
    if (tab !== "weekly") return
    setLoading(true)
    const dateStr = format(weeklyDate, "yyyy-MM-dd")
    Promise.all([
      getWeeklyStats(dateStr).catch(() => null),
    ]).then(([weekly]) => {
      setWeeklyData(weekly)
      if (weekly?.start_date && weekly?.end_date) {
        getTrendStats(weekly.start_date, weekly.end_date)
          .then(setWeeklyTrend)
          .catch(() => setWeeklyTrend(null))
      }
    }).finally(() => setLoading(false))
  }, [tab, weeklyDate])

  // Monthly + trend
  useEffect(() => {
    if (tab !== "monthly") return
    setLoading(true)
    getMonthlyStats(monthYear, monthMonth)
      .then((monthly) => {
        setMonthlyData(monthly)
        if (monthly?.start_date && monthly?.end_date) {
          getTrendStats(monthly.start_date, monthly.end_date)
            .then(setMonthlyTrend)
            .catch(() => setMonthlyTrend(null))
        }
      })
      .catch(() => setMonthlyData(null))
      .finally(() => setLoading(false))
  }, [tab, monthYear, monthMonth])
  // PLACEHOLDER_TREND_EFFECT
  // Trend tab
  useEffect(() => {
    if (tab !== "trend") return
    setLoading(true)
    const d = trendDate
    let startDate: string, endDate: string
    if (trendMode === "weekly") {
      const day = d.getDay() || 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - day + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      startDate = format(monday, "yyyy-MM-dd")
      endDate = format(sunday, "yyyy-MM-dd")
    } else {
      startDate = format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd")
      endDate = format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd")
    }
    getTrendStats(startDate, endDate)
      .then(setTrendData)
      .catch(() => setTrendData(null))
      .finally(() => setLoading(false))
  }, [tab, trendDate, trendMode])

  // Collect all unique categories from trend data for chart keys
  const collectCategories = (days: { summary: { category: string }[] }[]) => {
    const set = new Set<string>()
    for (const day of days) {
      for (const s of day.summary) set.add(s.category)
    }
    return Array.from(set)
  }

  const trendCategories = useMemo(
    () => collectCategories(trendData?.days || []),
    [trendData]
  )
  const weeklyTrendCategories = useMemo(
    () => collectCategories(weeklyTrend?.days || []),
    [weeklyTrend]
  )
  const monthlyTrendCategories = useMemo(
    () => collectCategories(monthlyTrend?.days || []),
    [monthlyTrend]
  )

  const openCategoryDetail = (category: string, items: DurationItem[]) => {
    setDetailCategory(category)
    setDetailItems(items)
    setDetailOpen(true)
  }

  const detailColor = getCatColor(detailCategory, 0)
  // PLACEHOLDER_RENDER

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-5xl mx-auto px-4 pb-20 sm:pb-4">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pt-4 pb-3">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-lg font-semibold">数据统计</h1>
        </motion.div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">日统计</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">周统计</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">月统计</TabsTrigger>
          <TabsTrigger value="trend" className="flex-1">趋势</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
              />
            </div>
          ) : (
            <>
              {/* Daily Tab */}
              <TabsContent value="daily" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => setDailyDate((d) => subDays(d, 1))}
                  onNext={() => setDailyDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
                  label={format(dailyDate, "yyyy年M月d日", { locale: zhCN })}
                />
                {dailyData ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PieChartCard
                        title="分类占比"
                        summary={dailyData.summary}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, dailyData.items)}
                      />
                      <SummaryList
                        summary={dailyData.summary}
                        totalKnown={dailyData.total_known}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, dailyData.items)}
                      />
                    </div>
                    <EventBarChart items={dailyData.items} getCatColor={getCatColor} />
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>
              {/* PLACEHOLDER_WEEKLY_TAB */}

              {/* Weekly Tab */}
              <TabsContent value="weekly" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => setWeeklyDate((d) => subDays(d, 7))}
                  onNext={() => setWeeklyDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
                  label={weeklyData ? `${weeklyData.start_date} ~ ${weeklyData.end_date}` : format(weeklyDate, "yyyy年 第w周", { locale: zhCN })}
                />
                {weeklyData ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PieChartCard
                        title="分类占比"
                        subtitle={`共 ${weeklyData.day_count} 天`}
                        summary={weeklyData.summary}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, weeklyData.items || [])}
                      />
                      <SummaryList
                        summary={weeklyData.summary}
                        totalKnown={weeklyData.total_known}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, weeklyData.items || [])}
                      />
                    </div>
                    {weeklyTrend && weeklyTrend.days.length > 0 && (
                      <StackedBarChart
                        days={weeklyTrend.days}
                        categories={weeklyTrendCategories}
                        getCatColor={getCatColor}
                      />
                    )}
                    {weeklyData.items && weeklyData.items.length > 0 && (
                      <TopEventsCard items={weeklyData.items} getCatColor={getCatColor} />
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>

              {/* Monthly Tab */}
              <TabsContent value="monthly" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => { if (monthMonth === 1) { setMonthYear((y) => y - 1); setMonthMonth(12) } else { setMonthMonth((m) => m - 1) } }}
                  onNext={() => { if (monthMonth === 12) { setMonthYear((y) => y + 1); setMonthMonth(1) } else { setMonthMonth((m) => m + 1) } }}
                  label={`${monthYear}年${monthMonth}月`}
                />
                {monthlyData ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PieChartCard
                        title="分类占比"
                        subtitle={`共 ${monthlyData.day_count} 天`}
                        summary={monthlyData.summary}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, monthlyData.items || [])}
                      />
                      <SummaryList
                        summary={monthlyData.summary}
                        totalKnown={monthlyData.total_known}
                        getCatColor={getCatColor}
                        onCategoryClick={(cat) => openCategoryDetail(cat, monthlyData.items || [])}
                      />
                    </div>
                    {monthlyTrend && monthlyTrend.days.length > 0 && (
                      <StackedBarChart
                        days={monthlyTrend.days}
                        categories={monthlyTrendCategories}
                        getCatColor={getCatColor}
                      />
                    )}
                    {monthlyData.items && monthlyData.items.length > 0 && (
                      <TopEventsCard items={monthlyData.items} getCatColor={getCatColor} />
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>

              {/* Trend Tab */}
              <TabsContent value="trend" className="mt-0 space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <button
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${trendMode === "weekly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    onClick={() => setTrendMode("weekly")}
                  >
                    按周
                  </button>
                  <button
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${trendMode === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    onClick={() => setTrendMode("monthly")}
                  >
                    按月
                  </button>
                </div>
                <DateNav
                  onPrev={() => setTrendDate((d) => trendMode === "weekly" ? subDays(d, 7) : new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  onNext={() => setTrendDate((d) => trendMode === "weekly" ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  label={trendData ? `${trendData.start_date} ~ ${trendData.end_date}` : format(trendDate, "yyyy年M月", { locale: zhCN })}
                />
                {trendData && trendData.days.length > 0 ? (
                  <>
                    <TrendChart
                      days={trendData.days}
                      categories={trendCategories}
                      getCatColor={getCatColor}
                    />
                    <DailyAverageCard days={trendData.days} getCatColor={getCatColor} />
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
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
  )
}