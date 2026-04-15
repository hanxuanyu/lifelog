import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  LoaderCircle,
  Search,
  Settings2,
} from "lucide-react"
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns"
import { getLogs } from "@/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchSettingsItems, type SettingsSearchItem, type SettingsSearchTab } from "@/lib/search-index"
import type { LogEntry } from "@/types"

interface GlobalSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RangePreset = "all" | "7" | "30" | "this-week" | "this-month" | "this-year" | "last-week" | "last-month" | "custom"

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi"))

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={`${part}-${index}`} className="rounded bg-primary/15 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  )
}

function getLogPreview(detail: string) {
  if (!detail) return "无详情"

  return detail
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([xX ])\]\s*/g, "")
    .replace(/[*_~`>|]/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
}

function getSettingsTabLabel(tab: SettingsSearchTab) {
  switch (tab) {
    case "app-info":
      return "设置首页"
    case "basic":
      return "基础配置"
    case "webhooks":
      return "Webhook"
    case "events":
      return "事件绑定"
    case "categories":
      return "分类管理"
  }
}

function ResultSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{count} 条</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [rangePreset, setRangePreset] = useState<RangePreset>("all")
  const [customDays, setCustomDays] = useState("14")
  const [page, setPage] = useState(1)
  const [logResults, setLogResults] = useState<LogEntry[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [settingsResults, setSettingsResults] = useState<SettingsSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const deferredQuery = useDeferredValue(query.trim())
  const normalizedCustomDays = Number.parseInt(customDays, 10)

  useEffect(() => {
    setPage(1)
  }, [deferredQuery, rangePreset, customDays])

  const getRangeParams = () => {
    const today = new Date()

    if (rangePreset === "this-week") {
      return {
        start_date: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end_date: format(today, "yyyy-MM-dd"),
      }
    }

    if (rangePreset === "this-month") {
      return {
        start_date: format(startOfMonth(today), "yyyy-MM-dd"),
        end_date: format(today, "yyyy-MM-dd"),
      }
    }

    if (rangePreset === "this-year") {
      return {
        start_date: format(startOfYear(today), "yyyy-MM-dd"),
        end_date: format(today, "yyyy-MM-dd"),
      }
    }

    if (rangePreset === "last-week") {
      const lastWeekDate = subWeeks(today, 1)
      return {
        start_date: format(startOfWeek(lastWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end_date: format(endOfWeek(lastWeekDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      }
    }

    if (rangePreset === "last-month") {
      const lastMonthDate = subMonths(today, 1)
      return {
        start_date: format(startOfMonth(lastMonthDate), "yyyy-MM-dd"),
        end_date: format(endOfMonth(lastMonthDate), "yyyy-MM-dd"),
      }
    }

    let days: number | null = null
    if (rangePreset === "7") days = 7
    if (rangePreset === "30") days = 30
    if (rangePreset === "custom" && Number.isFinite(normalizedCustomDays) && normalizedCustomDays > 0) {
      days = normalizedCustomDays
    }

    if (!days) return {}

    const startDate = subDays(today, days - 1)

    return {
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(today, "yyyy-MM-dd"),
    }
  }

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (open) return

    const timer = window.setTimeout(() => {
      setQuery("")
      setRangePreset("all")
      setCustomDays("14")
      setPage(1)
      setLogResults([])
      setLogTotal(0)
      setPageSize(20)
      setSettingsResults([])
      setLoading(false)
    }, 150)

    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    if (!deferredQuery) {
      setLogResults([])
      setSettingsResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)

      startTransition(() => {
        setSettingsResults(searchSettingsItems(deferredQuery))
      })

      try {
        const rangeParams = getRangeParams()
        const result = await getLogs({
          keyword: deferredQuery,
          ...rangeParams,
          page,
          size: 20,
        })

        if (cancelled) return

        startTransition(() => {
          setLogResults(result?.items || [])
          setLogTotal(result?.total || 0)
          setPageSize(result?.size || 20)
        })
      } catch {
        if (cancelled) return

        startTransition(() => {
          setLogResults([])
          setLogTotal(0)
          setPageSize(20)
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [customDays, deferredQuery, open, page, rangePreset])

  const resultCount = logResults.length + settingsResults.length
  const totalPages = Math.max(1, Math.ceil(logTotal / Math.max(1, pageSize)))
  const showPagination = logTotal > pageSize

  const handleOpenLog = (entry: LogEntry) => {
    onOpenChange(false)
    navigate("/", {
      state: {
        focusDate: entry.log_date,
        focusEntryId: entry.id,
      },
    })
  }

  const handleOpenSetting = (item: SettingsSearchItem) => {
    onOpenChange(false)
    navigate("/settings", {
      state: {
        searchTab: item.tab,
        searchSection: item.section,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(100dvh-1rem,42rem)] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[min(70vh,42rem)] sm:w-full sm:rounded-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            <span>全局搜索</span>
          </DialogTitle>
          <DialogDescription className="sr-only">搜索日志与设置</DialogDescription>
        </DialogHeader>

        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索日志或设置"
              className="h-11 rounded-xl pl-10"
            />
          </div>
          {!!query.trim() && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { key: "all" as const, label: "全部" },
                { key: "7" as const, label: "近 7 天" },
                { key: "30" as const, label: "近 30 天" },
                { key: "this-week" as const, label: "本周" },
                { key: "last-week" as const, label: "上周" },
                { key: "this-month" as const, label: "本月" },
                { key: "last-month" as const, label: "上月" },
                { key: "this-year" as const, label: "本年" },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  variant={rangePreset === preset.key ? "default" : "outline"}
                  size="sm"
                  className="h-7 rounded-lg px-2.5 text-[11px] sm:h-8 sm:rounded-xl sm:px-3 sm:text-xs"
                  onClick={() => setRangePreset(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
              <div className="flex h-7 min-w-[7rem] items-center gap-1.5 rounded-lg border px-2 sm:h-8 sm:min-w-[7.5rem] sm:rounded-xl sm:px-2.5">
                <Button
                  type="button"
                  variant={rangePreset === "custom" ? "default" : "ghost"}
                  size="sm"
                  className="h-5 rounded-md px-1.5 text-[11px] sm:h-6 sm:rounded-lg sm:px-2 sm:text-xs"
                  onClick={() => setRangePreset("custom")}
                >
                  近
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={customDays}
                  onChange={(event) => {
                    setCustomDays(event.target.value)
                    setRangePreset("custom")
                  }}
                  className="h-5 w-10 rounded-md border-0 px-1 text-center text-[11px] shadow-none focus-visible:ring-0 sm:h-6 sm:w-12 sm:text-xs"
                />
                <span className="text-[11px] text-muted-foreground sm:text-xs">天</span>
              </div>
            </div>
          )}
        </div>

        <div
          className="min-h-0 overflow-y-auto overscroll-contain p-4"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          <div className={`space-y-4 ${showPagination ? "pb-16" : ""}`}>
            {!query.trim() && (
              <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                输入关键字开始搜索
              </div>
            )}

            {!!query.trim() && settingsResults.length > 0 && (
              <ResultSection
                title="设置项"
                icon={<Settings2 className="h-4 w-4 text-muted-foreground" />}
                count={settingsResults.length}
              >
                {settingsResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenSetting(item)}
                    className="w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug">
                          <HighlightedText text={item.title} query={query} />
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          <HighlightedText text={item.description} query={query} />
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] text-secondary-foreground">
                        {getSettingsTabLabel(item.tab)}
                      </span>
                    </div>
                  </button>
                ))}
              </ResultSection>
            )}

            {!!query.trim() && (
              <ResultSection
                title="日志"
                icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                count={logTotal}
              >
                {loading && logResults.length === 0 && (
                  <div className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>正在搜索日志...</span>
                  </div>
                )}

                {logResults.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleOpenLog(entry)}
                    className="w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm leading-snug">
                          <span className="min-w-0 truncate font-medium">
                            <HighlightedText text={entry.event_type} query={query} />
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            <HighlightedText
                              text={entry.time_range || `${entry.log_time.slice(0, 5)} ~ ...`}
                              query={query}
                            />
                          </span>
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                            {entry.category || "未分类"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <HighlightedText text={entry.log_date} query={query} />
                          </span>
                        </div>
                        <p
                          className="mt-1 line-clamp-1 text-xs text-muted-foreground"
                          style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 1,
                            overflow: "hidden",
                          }}
                        >
                          <HighlightedText text={getLogPreview(entry.detail)} query={query} />
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </ResultSection>
            )}

            {!!query.trim() && !loading && resultCount === 0 && (
              <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                没有找到结果
              </div>
            )}
          </div>
        </div>

        {showPagination && (
          <div className="border-t bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center justify-between rounded-xl border px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-xs text-muted-foreground">
                第 {page} / {totalPages} 页
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
