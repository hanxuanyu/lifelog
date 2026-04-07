import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tag, FileText, X, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MobileTimePicker } from "@/components/MobileTimePicker"
import { MarkdownEditor } from "@/components/MarkdownEditor"

export interface SuggestionTag {
  name: string
  categoryName?: string
  categoryColor?: string
}

export interface EventFormProps {
  time: string
  event: string
  detail: string
  onTimeChange: (time: string) => void
  onEventChange: (event: string) => void
  onDetailChange: (detail: string) => void

  onSubmit: () => void
  onCancel?: () => void
  showActions?: boolean
  submitLabel?: string
  submitIcon?: React.ReactNode
  submitting?: boolean
  cancelLabel?: string
  cancelIcon?: React.ReactNode

  suggestions?: SuggestionTag[]

  eventInputRef?: React.RefObject<HTMLInputElement | null>
  initialDetailOpen?: boolean
}

export function EventForm({
  time,
  event,
  detail,
  onTimeChange,
  onEventChange,
  onDetailChange,
  onSubmit,
  onCancel,
  showActions = true,
  submitLabel = "提交",
  submitIcon,
  submitting = false,
  cancelLabel = "取消",
  cancelIcon = <X className="h-3.5 w-3.5 mr-1" />,
  suggestions,
  eventInputRef,
  initialDetailOpen = false,
}: EventFormProps) {
  const [showDetail, setShowDetail] = useState(initialDetailOpen)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Group suggestions by category
  const categoryGroups = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return []
    const map = new Map<string, { name: string; color?: string; items: SuggestionTag[] }>()
    for (const s of suggestions) {
      const catName = s.categoryName || "未分类"
      if (!map.has(catName)) {
        map.set(catName, { name: catName, color: s.categoryColor, items: [] })
      }
      map.get(catName)!.items.push(s)
    }
    return Array.from(map.values())
  }, [suggestions])

  // When user is typing, filter all suggestions flat
  const filteredSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return []
    if (!event.trim()) return []
    return suggestions.filter((s) =>
      s.name.toLowerCase().includes(event.toLowerCase())
    )
  }, [suggestions, event])

  const isSearching = event.trim().length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: time picker (left) + event input (right) */}
      <div className="flex gap-3 items-stretch">
        {/* Time picker */}
        <div className="shrink-0">
          <MobileTimePicker compact value={time} onChange={onTimeChange} />
        </div>

        {/* Right side: event input */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={eventInputRef}
              value={event}
              onChange={(e) => onEventChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onSubmit()
                }
                if (e.key === "Escape") onCancel?.()
              }}
              placeholder="做了什么..."
              className="h-10 rounded-xl bg-accent/50 border-0 text-base"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setShowDetail(!showDetail)}
              className={`shrink-0 ${
                showDetail ? "text-primary bg-primary/10" : "text-muted-foreground"
              }`}
              title="添加详情"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Suggestion tags — two-level or flat search */}
      {isSearching ? (
        filteredSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filteredSuggestions.map((s) => {
              const isSelected = event === s.name
              return (
                <Badge
                  key={s.name}
                  asChild
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer h-auto py-1 px-2.5 gap-1.5 ${
                    isSelected
                      ? ""
                      : "bg-accent/60 text-secondary-foreground border-transparent hover:bg-accent hover:border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onEventChange(isSelected ? "" : s.name)}
                  >
                    {s.categoryColor && !isSelected && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.categoryColor }}
                      />
                    )}
                    {s.name}
                  </button>
                </Badge>
              )
            })}
          </div>
        )
      ) : (
        categoryGroups.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {/* Category badges */}
            <div className="flex flex-wrap gap-1.5">
              {categoryGroups.map((group) => {
                const isExpanded = expandedCategory === group.name
                return (
                  <Badge
                    key={group.name}
                    asChild
                    variant={isExpanded ? "default" : "outline"}
                    className={`cursor-pointer h-auto py-1 px-2.5 gap-1.5 ${
                      isExpanded
                        ? ""
                        : "bg-accent/60 text-secondary-foreground border-transparent hover:bg-accent hover:border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCategory(isExpanded ? null : group.name)}
                    >
                      {group.color && !isExpanded && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      {group.name}
                      <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </Badge>
                )
              })}
            </div>
            {/* Expanded sub-items */}
            <AnimatePresence>
              {expandedCategory && (() => {
                const group = categoryGroups.find((g) => g.name === expandedCategory)
                if (!group) return null
                return (
                  <motion.div
                    key={expandedCategory}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5 pl-2 border-l-2" style={{ borderColor: group.color || undefined }}>
                      {group.items.map((s) => {
                        const isSelected = event === s.name
                        return (
                          <Badge
                            key={s.name}
                            asChild
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer h-auto py-1 px-2.5 gap-1.5 ${
                              isSelected
                                ? ""
                                : "bg-accent/60 text-secondary-foreground border-transparent hover:bg-accent hover:border-border"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onEventChange(isSelected ? "" : s.name)}
                            >
                              {s.name}
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>
        )
      )}

      {/* Detail editor */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <MarkdownEditor
              value={detail}
              onChange={onDetailChange}
              placeholder="输入详情（支持 Markdown）..."
              minHeight={100}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {showActions && (
        <div className="flex justify-end gap-1">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {cancelIcon} {cancelLabel}
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={submitting || !event.trim() || !time.trim()}
          >
            {submitIcon && <span className="mr-1">{submitIcon}</span>}
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
