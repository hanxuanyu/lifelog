import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Clock, FileText, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createLog, getCategories, getTimeline } from "@/api"
import type { Category, LogEntry } from "@/types"
import { toast } from "@/hooks/use-toast"

interface LogInputProps {
  onLogCreated: () => void
  date: string
}

export function LogInput({ onLogCreated, date }: LogInputProps) {
  const [timeValue, setTimeValue] = useState("")
  const [eventValue, setEventValue] = useState("")
  const [detailValue, setDetailValue] = useState("")
  const [showDetail, setShowDetail] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1)
  const [categories, setCategories] = useState<Category[]>([])
  const [recentEvents, setRecentEvents] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const eventInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    getTimeline(date).then((entries: LogEntry[]) => {
      const events = [...new Set(entries.map((e) => e.event_type))].reverse()
      setRecentEvents(events)
    }).catch(() => {})
  }, [date])

  const getAllKnownEvents = useCallback(() => {
    const fixedEvents: string[] = []
    categories.forEach((cat) => {
      cat.rules.forEach((rule) => {
        if (rule.type === "fixed") {
          fixedEvents.push(rule.pattern)
        }
      })
    })
    return [...new Set([...recentEvents, ...fixedEvents])]
  }, [categories, recentEvents])

  const handleEventChange = (value: string) => {
    setEventValue(value)
    if (value.trim()) {
      const allEvents = getAllKnownEvents()
      const filtered = allEvents.filter((e) =>
        e.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSelectedSuggestion(-1)
    } else {
      setSuggestions(getAllKnownEvents().slice(0, 8))
      setShowSuggestions(true)
      setSelectedSuggestion(-1)
    }
  }

  const handleEventFocus = () => {
    if (!eventValue.trim()) {
      setSuggestions(getAllKnownEvents().slice(0, 8))
      setShowSuggestions(true)
    }
  }

  const handleEventKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (selectedSuggestion >= 0) {
          selectSuggestion(suggestions[selectedSuggestion])
        } else {
          setShowSuggestions(false)
          handleSubmit()
        }
        break
      case "Escape":
        setShowSuggestions(false)
        break
      case "Tab":
        if (selectedSuggestion >= 0) {
          e.preventDefault()
          selectSuggestion(suggestions[selectedSuggestion])
        }
        break
    }
  }

  const selectSuggestion = (value: string) => {
    setEventValue(value)
    setShowSuggestions(false)
    setSelectedSuggestion(-1)
  }

  const formatTimeInput = (value: string): string => {
    const digits = value.replace(/\D/g, "")
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTimeInput(e.target.value)
    setTimeValue(formatted)
  }

  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      eventInputRef.current?.focus()
    }
  }

  const setCurrentTime = () => {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, "0")
    const m = String(now.getMinutes()).padStart(2, "0")
    setTimeValue(`${h}:${m}`)
    eventInputRef.current?.focus()
  }

  const handleSubmit = async () => {
    if (!timeValue.trim() || !eventValue.trim()) {
      toast({
        title: "请填写完整",
        description: "时间和事项不能为空",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await createLog({
        log_date: date,
        log_time: timeValue,
        event_type: eventValue.trim(),
        detail: detailValue.trim() || undefined,
      })
      toast({ title: "记录成功" })
      setTimeValue("")
      setEventValue("")
      setDetailValue("")
      setShowDetail(false)
      if (!recentEvents.includes(eventValue.trim())) {
        setRecentEvents((prev) => [eventValue.trim(), ...prev])
      }
      onLogCreated()
      timeInputRef.current?.focus()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "提交失败"
      toast({ title: "错误", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        eventInputRef.current &&
        !eventInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Time + Event row */}
          <div className="flex gap-2">
            <div className="relative flex items-center">
              <Input
                ref={timeInputRef}
                value={timeValue}
                onChange={handleTimeChange}
                onKeyDown={handleTimeKeyDown}
                placeholder="时间"
                className="w-[80px] sm:w-[90px] text-center font-mono pr-7"
                maxLength={5}
              />
              <button
                type="button"
                onClick={setCurrentTime}
                className="absolute right-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="当前时间"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative flex-1">
              <Input
                ref={eventInputRef}
                value={eventValue}
                onChange={(e) => handleEventChange(e.target.value)}
                onFocus={handleEventFocus}
                onKeyDown={handleEventKeyDown}
                placeholder="做了什么..."
                className="pr-8"
              />
              <button
                type="button"
                onClick={() => setShowDetail(!showDetail)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 transition-colors ${
                  showDetail ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                title="添加详情"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    ref={suggestionsRef}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden"
                  >
                    {suggestions.map((s, i) => {
                      const cat = categories.find((c) =>
                        c.rules.some((r) => {
                          if (r.type === "fixed") return r.pattern === s
                          try { return new RegExp(r.pattern).test(s) } catch { return false }
                        })
                      )
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                            i === selectedSuggestion
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectSuggestion(s)
                          }}
                          onMouseEnter={() => setSelectedSuggestion(i)}
                        >
                          <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{s}</span>
                          {cat && (
                            <span className="ml-auto text-xs text-muted-foreground shrink-0">
                              {cat.name}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={submitting}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Detail row */}
          <AnimatePresence>
            {showDetail && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Input
                  value={detailValue}
                  onChange={(e) => setDetailValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="详情（可选）"
                  className="text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
