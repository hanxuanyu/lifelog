import { useState, useEffect, useCallback } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteLog } from "@/api"
import type { LogEntry, Category, DurationItem, CrossDayHint } from "@/types"
import { toast } from "sonner"
import { getCategoryColorFn } from "./shared"
import { ListView } from "./ListView"

interface TimelineProps {
  entries: LogEntry[]
  onUpdate: () => void
  categories?: Category[]
  date?: string
  isToday?: boolean
  durationItems?: DurationItem[]
  crossDayHints?: CrossDayHint[]
  prevDayLastTime?: string
  timePointMode?: string
  onEditRequest?: (entry: LogEntry) => void
  onRailCreate?: (time: string) => void
}

export function Timeline({
  entries,
  onUpdate,
  categories,
  date,
  isToday = false,
  durationItems = [],
  crossDayHints = [],
  prevDayLastTime,
  timePointMode = "end",
  onEditRequest,
  onRailCreate,
}: TimelineProps) {
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  })

  // Update current time every 30s
  useEffect(() => {
    if (!isToday) return
    const tick = () => {
      const now = new Date()
      setCurrentTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      )
    }
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [isToday])

  const getCategoryColor = useCallback(
    (category: string) => getCategoryColorFn(category, categories),
    [categories]
  )

  const getDurationForEntry = useCallback(
    (index: number): DurationItem | null => {
      if (index < durationItems.length) return durationItems[index]
      return null
    },
    [durationItems]
  )

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      await deleteLog(deleteTarget)
      toast.success("已删除")
      setDeleteTarget(null)
      onUpdate()
    } catch {
      toast.error("删除失败")
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* View content — fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ListView
          entries={entries}
          durationItems={durationItems}
          onUpdate={onUpdate}
          onDeleteRequest={setDeleteTarget}
          getCategoryColor={getCategoryColor}
          getDurationForEntry={getDurationForEntry}
          crossDayHints={crossDayHints}
          prevDayLastTime={prevDayLastTime}
          isToday={isToday}
          currentTime={currentTime}
          timePointMode={timePointMode}
          onEditRequest={onEditRequest}
          onRailCreate={onRailCreate}
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，确定要删除这条记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
