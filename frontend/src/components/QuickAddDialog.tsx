import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Clock, Tag, FileText } from "lucide-react"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MobileTimePicker } from "@/components/MobileTimePicker"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { createLog, getCategories, getEventTypes, getTimeline } from "@/api"
import type { Category } from "@/types"
import { toast } from "sonner"

interface QuickAddDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function QuickAddDialog({ open, onClose, onCreated }: QuickAddDialogProps) {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, "0")
  const m = String(now.getMinutes()).padStart(2, "0")

  const [timeValue, setTimeValue] = useState(`${h}:${m}`)
  const [eventValue, setEventValue] = useState("")
  const [detailValue, setDetailValue] = useState("")
  const [showDetail, setShowDetail] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allEvents, setAllEvents] = useState<string[]>([])

  const eventInputRef = useRef<HTMLInputElement>(null)
  const dateStr = format(now, "yyyy-MM-dd")

  useEffect(() => {
    if (open) {
      const n = new Date()
      setTimeValue(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`)
      setEventValue("")
      setDetailValue("")
      setShowDetail(false)
      setShowTimePicker(false)

      Promise.all([
        getCategories().catch(() => [] as Category[]),
        getEventTypes().catch(() => [] as string[]),
        getTimeline(dateStr).catch(() => []),
      ]).then(([cats, types, entries]) => {
        setCategories(cats || [])
        const recent = [...new Set(entries.map((e) => e.event_type))].reverse()
        const fixedEvents: string[] = []
        ;(cats || []).forEach((cat) =>
          cat.rules.forEach((r) => {
            if (r.type === "fixed") fixedEvents.push(r.pattern)
          })
        )
        setAllEvents([...new Set([...recent, ...fixedEvents, ...types])])
      })

      setTimeout(() => eventInputRef.current?.focus(), 100)
    }
  }, [open])

  const filteredTags = eventValue.trim()
    ? allEvents.filter((e) => e.toLowerCase().includes(eventValue.toLowerCase()))
    : allEvents

  const handleEventChange = (value: string) => {
    setEventValue(value)
  }

  const handleSubmit = async () => {
    if (!timeValue.trim() || !eventValue.trim()) {
      toast.error("请填写完整", { description: "时间和事项不能为空" })
      return
    }
    setSubmitting(true)
    try {
      await createLog({
        log_date: dateStr,
        log_time: timeValue,
        event_type: eventValue.trim(),
        detail: detailValue.trim() || undefined,
      })
      toast.success("记录成功")
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "提交失败"
      toast.error("提交失败", { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-background rounded-2xl shadow-2xl border max-w-md mx-auto max-h-[80vh] flex flex-col"
          >
            {/* Fixed header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
              <h3 className="text-base font-semibold">快速记录</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-accent transition-colors text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {/* Time section */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowTimePicker(!showTimePicker)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/50 hover:bg-accent transition-colors w-full"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-lg font-medium">{timeValue}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {showTimePicker ? "收起" : "点击选择时间"}
                  </span>
                </button>

                <AnimatePresence>
                  {showTimePicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <MobileTimePicker value={timeValue} onChange={setTimeValue} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Event input */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    ref={eventInputRef}
                    value={eventValue}
                    onChange={(e) => handleEventChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSubmit()
                      }
                    }}
                    placeholder="做了什么..."
                    className="h-10 rounded-xl bg-accent/50 border-0 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDetail(!showDetail)}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      showDetail ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    title="添加详情"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Detail editor */}
              <AnimatePresence>
                {showDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mb-3"
                  >
                    <MarkdownEditor
                      value={detailValue}
                      onChange={setDetailValue}
                      placeholder="输入详情（支持 Markdown）..."
                      minHeight={100}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestion tags */}
              {filteredTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filteredTags.map((s) => {
                    const cat = categories.find((c) =>
                      c.rules.some((r) => {
                        if (r.type === "fixed") return r.pattern === s
                        try { return new RegExp(r.pattern).test(s) } catch { return false }
                      })
                    )
                    const isSelected = eventValue === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEventValue(isSelected ? "" : s)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-accent/60 text-secondary-foreground border-transparent hover:bg-accent hover:border-border"
                        }`}
                      >
                        {cat && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: isSelected ? undefined : cat.color }}
                          />
                        )}
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fixed footer */}
            <div className="px-5 pb-5 pt-3 border-t shrink-0">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !eventValue.trim() || !timeValue.trim()}
                className="w-full h-11 rounded-xl text-base font-medium"
              >
                {submitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    记录
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
