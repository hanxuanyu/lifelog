import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { getDailyStats, getWeeklyStats, getMonthlyStats, getCategories } from "@/api"
import type { DailyStatistics, PeriodStatistics, CategorySummary, DurationItem, Category } from "@/types"

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1",
]

function durationToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

export function StatisticsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("daily")
  const [dailyDate, setDailyDate] = useState(new Date())
  const [weeklyDate, setWeeklyDate] = useState(new Date())
  const [monthYear, setMonthYear] = useState(new Date().getFullYear())
  const [monthMonth, setMonthMonth] = useState(new Date().getMonth() + 1)
  const [dailyData, setDailyData] = useState<DailyStatistics | null>(null)
  const [weeklyData, setWeeklyData] = useState<PeriodStatistics | null>(null)
  const [monthlyData, setMonthlyData] = useState<PeriodStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [catColors, setCatColors] = useState<Record<string, string>>({})

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

  useEffect(() => {
    if (tab === "daily") {
      setLoading(true)
      getDailyStats(format(dailyDate, "yyyy-MM-dd"))
        .then(setDailyData)
        .catch(() => setDailyData(null))
        .finally(() => setLoading(false))
    }
  }, [tab, dailyDate])

  useEffect(() => {
    if (tab === "weekly") {
      setLoading(true)
      getWeeklyStats(format(weeklyDate, "yyyy-MM-dd"))
        .then(setWeeklyData)
        .catch(() => setWeeklyData(null))
        .finally(() => setLoading(false))
    }
  }, [tab, weeklyDate])

  useEffect(() => {
    if (tab === "monthly") {
      setLoading(true)
      getMonthlyStats(monthYear, monthMonth)
        .then(setMonthlyData)
        .catch(() => setMonthlyData(null))
        .finally(() => setLoading(false))
    }
  }, [tab, monthYear, monthMonth])

  const renderPieChart = (summary: CategorySummary[]) => {
    if (!summary || summary.length === 0) {
      return <p className="text-center text-muted-foreground py-8 text-sm">暂无数据</p>
    }
    const data = summary.map((s) => ({
      name: s.category,
      value: durationToHours(s.duration),
      percentage: s.percentage,
      display: s.display,
    }))

    return (
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
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const renderBarChart = (items: DurationItem[]) => {
    if (!items || items.length === 0) {
      return <p className="text-center text-muted-foreground py-8 text-sm">暂无数据</p>
    }
    const data = items.map((item) => ({
      name: item.event_type.length > 6 ? item.event_type.slice(0, 6) + "…" : item.event_type,
      fullName: item.event_type,
      hours: durationToHours(item.duration),
      category: item.category,
      display: item.display,
    }))

    return (
      <ResponsiveContainer width="100%" height={Math.max(280, items.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" unit="h" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, _, props) => [
              (props as any).payload?.display || `${value}h`,
              (props as any).payload?.fullName || "",
            ]}
          />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={getCatColor(d.category, i)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderSummaryList = (summary: CategorySummary[], totalKnown: string) => (
    <div className="space-y-2">
      {summary?.map((s, i) => (
        <motion.div
          key={s.category}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
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
  )

  const DateNav = ({
    onPrev,
    onNext,
    label,
  }: {
    onPrev: () => void
    onNext: () => void
    label: string
  }) => (
    <div className="flex items-center justify-center gap-2 mb-4">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center">{label}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-20 sm:pb-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4 max-w-5xl mx-auto w-full"
      >
        <Button size="icon" variant="ghost" onClick={() => navigate("/", { replace: true })} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">数据统计</h1>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full">
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">日统计</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">周统计</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1">月统计</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 mt-4">
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
              <TabsContent value="daily" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => setDailyDate((d) => subDays(d, 1))}
                  onNext={() => setDailyDate((d) => {
                    const next = new Date(d)
                    next.setDate(next.getDate() + 1)
                    return next
                  })}
                  label={format(dailyDate, "yyyy年M月d日", { locale: zhCN })}
                />

                {dailyData ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">分类占比</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {renderPieChart(dailyData.summary)}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">汇总</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {renderSummaryList(dailyData.summary, dailyData.total_known)}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">事项时长</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderBarChart(dailyData.items)}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>

              <TabsContent value="weekly" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => setWeeklyDate((d) => subDays(d, 7))}
                  onNext={() => setWeeklyDate((d) => {
                    const next = new Date(d)
                    next.setDate(next.getDate() + 7)
                    return next
                  })}
                  label={
                    weeklyData
                      ? `${weeklyData.start_date} ~ ${weeklyData.end_date}`
                      : format(weeklyDate, "yyyy年 第w周", { locale: zhCN })
                  }
                />

                {weeklyData ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          分类占比
                          <span className="text-xs text-muted-foreground ml-2">
                            共 {weeklyData.day_count} 天
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderPieChart(weeklyData.summary)}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">汇总</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderSummaryList(weeklyData.summary, weeklyData.total_known)}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>

              <TabsContent value="monthly" className="mt-0 space-y-4">
                <DateNav
                  onPrev={() => {
                    if (monthMonth === 1) {
                      setMonthYear((y) => y - 1)
                      setMonthMonth(12)
                    } else {
                      setMonthMonth((m) => m - 1)
                    }
                  }}
                  onNext={() => {
                    if (monthMonth === 12) {
                      setMonthYear((y) => y + 1)
                      setMonthMonth(1)
                    } else {
                      setMonthMonth((m) => m + 1)
                    }
                  }}
                  label={`${monthYear}年${monthMonth}月`}
                />

                {monthlyData ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          分类占比
                          <span className="text-xs text-muted-foreground ml-2">
                            共 {monthlyData.day_count} 天
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderPieChart(monthlyData.summary)}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">汇总</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderSummaryList(monthlyData.summary, monthlyData.total_known)}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12 text-sm">暂无数据</p>
                )}
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  )
}
