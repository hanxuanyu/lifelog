import { useMemo, useState } from "react"
import { format, isValid, parseISO } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Loader2,
  PencilLine,
  RefreshCw,
  Send,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { createLogMarker, getLogSuggestions, getLogs, updateLog } from "@/api"
import { MobileTimePicker } from "@/components/MobileTimePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { LogEntry, LogSuggestionCandidate } from "@/types"

type ApiScenario = "suggestions" | "create-marker" | "list-markers" | "complete-marker"

interface ApiCard {
  id: ApiScenario
  method: "GET" | "POST" | "PUT"
  path: string
  title: string
  description: string
  icon: LucideIcon
}

const API_CARDS: ApiCard[] = [
  {
    id: "suggestions",
    method: "GET",
    path: "/api/logs/suggestions",
    title: "事项推断",
    description: "按指定结束时间点推断可能刚完成的事项，供外部 App 或硬件面板展示候选列表。",
    icon: Lightbulb,
  },
  {
    id: "create-marker",
    method: "POST",
    path: "/api/logs/markers",
    title: "创建待补全记录",
    description: "只写入一个结束时间点，暂不填写事项和详情，适合按钮、快捷指令等低打断入口。",
    icon: Flag,
  },
  {
    id: "list-markers",
    method: "GET",
    path: "/api/logs?marker=true",
    title: "查询待补全记录",
    description: "拉取尚未补全的空白结束点记录，方便事后集中整理。",
    icon: ListChecks,
  },
  {
    id: "complete-marker",
    method: "PUT",
    path: "/api/logs/:id",
    title: "补全记录",
    description: "将已记录的结束时间点补充为正式日志，写入事项、详情和分类推断结果。",
    icon: PencilLine,
  },
]

function todayDate() {
  const now = new Date()
  return format(now, "yyyy-MM-dd")
}

function currentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

function parseDateValue(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function formatDisplayDate(value: string) {
  const parsed = parseDateValue(value)
  if (!parsed) return "选择日期"
  return format(parsed, "yyyy年M月d日 EEE", { locale: zhCN })
}

function formatResult(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error) return error.message
  return "请求失败"
}

function MethodBadge({ method }: { method: ApiCard["method"] }) {
  const className = method === "GET"
    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
    : method === "POST"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"

  return <Badge variant="outline" className={className}>{method}</Badge>
}

function ApiDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = parseDateValue(value)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">日期</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 w-full justify-start rounded-lg px-3 text-left font-normal">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="truncate">{formatDisplayDate(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day) onChange(format(day, "yyyy-MM-dd"))
            }}
            locale={zhCN}
            captionLayout="dropdown"
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ApiTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">结束时间</Label>
      <div className="flex h-10 items-center justify-center rounded-lg border bg-background px-2">
        <MobileTimePicker compact value={value} onChange={onChange} />
      </div>
    </div>
  )
}

export function ExternalApiTestCard() {
  const [activeScenario, setActiveScenario] = useState<ApiScenario | null>(null)
  const [date, setDate] = useState(todayDate)
  const [time, setTime] = useState(currentTime)
  const [limit, setLimit] = useState(5)
  const [pageSize, setPageSize] = useState(20)
  const [source, setSource] = useState("settings-test")
  const [markerId, setMarkerId] = useState("")
  const [eventType, setEventType] = useState("")
  const [detail, setDetail] = useState("")
  const [suggestions, setSuggestions] = useState<LogSuggestionCandidate[]>([])
  const [markers, setMarkers] = useState<LogEntry[]>([])
  const [resultText, setResultText] = useState("")
  const [loading, setLoading] = useState(false)

  const activeCard = useMemo(
    () => API_CARDS.find((card) => card.id === activeScenario) || null,
    [activeScenario],
  )

  const selectedMarker = useMemo(
    () => markers.find((marker) => String(marker.id) === markerId) || null,
    [markers, markerId],
  )

  const setResult = (label: string, value: unknown) => {
    setResultText(`${label}\n${formatResult(value)}`)
  }

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true)
    try {
      await action()
    } catch (error) {
      toast.error(getErrorMessage(error))
      setResult("错误", error)
    } finally {
      setLoading(false)
    }
  }

  const openScenario = (scenario: ApiScenario) => {
    setActiveScenario(scenario)
    setResultText("")
    setSuggestions([])
  }

  const useCurrentDateTime = () => {
    setDate(todayDate())
    setTime(currentTime())
  }

  const loadMarkers = async () => {
    const page = await getLogs({ marker: true, page: 1, size: pageSize })
    const items = page?.items || []
    setMarkers(items)
    setMarkerId((current) => {
      if (current && items.some((item) => String(item.id) === current)) return current
      return items[0] ? String(items[0].id) : ""
    })
    return page
  }

  const applySelectedMarker = (id: string) => {
    setMarkerId(id)
    const marker = markers.find((item) => String(item.id) === id)
    if (marker) {
      setDate(marker.log_date)
      setTime(marker.log_time.slice(0, 5))
    }
  }

  const handleFetchSuggestions = () => runAction(async () => {
    const data = await getLogSuggestions({ log_date: date, log_time: time, limit })
    setSuggestions(data?.candidates || [])
    setResult("事项推断结果", data)
    toast.success("推断完成")
  })

  const handleCreateMarker = () => runAction(async () => {
    const marker = await createLogMarker({
      log_date: date,
      log_time: time,
      source: source.trim() || "settings-test",
    })
    setResult("待补全记录创建结果", marker)
    toast.success("待补全记录已创建")
    window.dispatchEvent(new CustomEvent("logCreated"))
  })

  const handleLoadMarkers = () => runAction(async () => {
    const page = await loadMarkers()
    setResult("待补全记录列表", page)
    toast.success("列表已刷新")
  })

  const handleCompleteMarker = () => runAction(async () => {
    const id = Number(markerId)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error("请先输入或选择记录 ID")
      return
    }
    if (!eventType.trim()) {
      toast.error("请先输入补全事项")
      return
    }

    const entry = await updateLog(id, {
      log_date: selectedMarker?.log_date || date,
      log_time: selectedMarker?.log_time.slice(0, 5) || time,
      event_type: eventType.trim(),
      detail: detail.trim() || undefined,
    })
    setResult("记录补全结果", entry)
    toast.success("记录已补全")
    window.dispatchEvent(new CustomEvent("logCreated"))
    await loadMarkers()
  })

  const renderSharedTimeFields = () => (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(11rem,0.8fr)_auto]">
      <ApiDatePicker value={date} onChange={setDate} />
      <ApiTimePicker value={time} onChange={setTime} />
      <div className="flex items-end">
        <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={useCurrentDateTime}>
          <Clock3 className="mr-1.5 h-3.5 w-3.5" />
          当前
        </Button>
      </div>
    </div>
  )

  const renderDialogBody = () => {
    if (activeScenario === "suggestions") {
      return (
        <>
          {renderSharedTimeFields()}
          <div className="space-y-1.5">
            <Label htmlFor="external-api-limit" className="text-xs text-muted-foreground">候选数量</Label>
            <Input
              id="external-api-limit"
              type="number"
              min={1}
              max={20}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 5)}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">推断候选</p>
              <div className="grid gap-2">
                {suggestions.map((candidate) => (
                  <div key={candidate.event_type} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{candidate.event_type}</span>
                      <Badge variant="outline" className="text-[10px]">{candidate.category}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )
    }

    if (activeScenario === "create-marker") {
      return (
        <>
          {renderSharedTimeFields()}
          <div className="space-y-1.5">
            <Label htmlFor="external-api-source" className="text-xs text-muted-foreground">来源标识</Label>
            <Input id="external-api-source" value={source} onChange={(event) => setSource(event.target.value)} />
          </div>
        </>
      )
    }

    if (activeScenario === "list-markers") {
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="external-api-page-size" className="text-xs text-muted-foreground">返回数量</Label>
            <Input
              id="external-api-page-size"
              type="number"
              min={1}
              max={100}
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) || 20)}
            />
          </div>
          {markers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">最近待补全记录</p>
              <div className="max-h-52 space-y-2 overflow-auto rounded-lg border p-2">
                {markers.map((marker) => (
                  <div key={marker.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium">#{marker.id}</span>
                    <span className="text-xs text-muted-foreground">{marker.log_date} {marker.log_time.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (activeScenario === "complete-marker") {
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="external-api-marker-id" className="text-xs text-muted-foreground">记录 ID</Label>
              <Input
                id="external-api-marker-id"
                value={markerId}
                onChange={(event) => setMarkerId(event.target.value)}
                placeholder="例如：12"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => void handleLoadMarkers()} disabled={loading}>
                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                加载记录
              </Button>
            </div>
          </div>

          {markers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">从待补全列表选择</Label>
              <Select value={markerId} onValueChange={applySelectedMarker}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="选择待补全记录" />
                </SelectTrigger>
                <SelectContent>
                  {markers.map((marker) => (
                    <SelectItem key={marker.id} value={String(marker.id)}>
                      #{marker.id} {marker.log_date} {marker.log_time.slice(0, 5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {renderSharedTimeFields()}

          <div className="space-y-1.5">
            <Label htmlFor="external-api-event-type" className="text-xs text-muted-foreground">补全事项</Label>
            <Input
              id="external-api-event-type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              placeholder="例如：深度工作"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="external-api-detail" className="text-xs text-muted-foreground">详情</Label>
            <Textarea
              id="external-api-detail"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="可选，补充这段时间发生了什么"
              rows={3}
            />
          </div>
        </>
      )
    }

    return null
  }

  const renderDialogAction = () => {
    if (activeScenario === "suggestions") {
      return (
        <Button onClick={handleFetchSuggestions} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="mr-1.5 h-3.5 w-3.5" />}
          执行推断
        </Button>
      )
    }
    if (activeScenario === "create-marker") {
      return (
        <Button onClick={handleCreateMarker} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Flag className="mr-1.5 h-3.5 w-3.5" />}
          创建记录
        </Button>
      )
    }
    if (activeScenario === "list-markers") {
      return (
        <Button onClick={handleLoadMarkers} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          查询列表
        </Button>
      )
    }
    if (activeScenario === "complete-marker") {
      return (
        <Button onClick={handleCompleteMarker} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          补全记录
        </Button>
      )
    }
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4" />
            外部 API 测试
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {API_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => openScenario(card.id)}
                  className="group rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-medium">{card.title}</h3>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{card.path}</p>
                      </div>
                    </div>
                    <MethodBadge method={card.method} />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                  <div className="mt-4 flex items-center text-xs font-medium text-primary">
                    打开测试
                    <Send className="ml-1.5 h-3.5 w-3.5" />
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!activeScenario} onOpenChange={(open) => !open && setActiveScenario(null)}>
        <DialogContent className="grid max-h-[min(100dvh-1rem,46rem)] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              {activeCard && <MethodBadge method={activeCard.method} />}
              <Badge variant="outline" className="font-mono text-[10px]">{activeCard?.path}</Badge>
            </div>
            <DialogTitle className="pt-2 text-base">{activeCard?.title}</DialogTitle>
            <DialogDescription>{activeCard?.description}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-4">
              {renderDialogBody()}

              {resultText && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">响应结果</p>
                    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                      {resultText}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setActiveScenario(null)} disabled={loading}>关闭</Button>
            {renderDialogAction()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
