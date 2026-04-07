import { useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Maximize2, Copy, Tag } from "lucide-react"
import type { LogEntry } from "@/types"
import { toast } from "sonner"
import { formatTime } from "./shared"

interface CardContextMenuProps {
  contextMenu: { entry: LogEntry; x: number; y: number } | null
  menuPos: { left: number; top: number } | null
  setMenuPos: (pos: { left: number; top: number } | null) => void
  onClose: () => void
  onEditRequest?: (entry: LogEntry) => void
  onDeleteRequest: (id: number) => void
  onDetailView: (title: string, detail: string, time: string) => void
  onAssignCategory: (eventType: string) => void
}

export function CardContextMenu({
  contextMenu, menuPos, setMenuPos, onClose,
  onEditRequest, onDeleteRequest, onDetailView, onAssignCategory,
}: CardContextMenuProps) {
  const callbackRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || !contextMenu) return
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const pad = 8
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = contextMenu.x - rect.width / 2
      if (left < pad) left = pad
      else if (left + rect.width > vw - pad) left = vw - pad - rect.width
      let top = contextMenu.y - rect.height - 4
      if (top < pad) top = contextMenu.y + 4
      if (top + rect.height > vh - pad) top = vh - pad - rect.height
      setMenuPos({ left, top })
    })
  }, [contextMenu, setMenuPos])

  return (
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          ref={!menuPos ? callbackRef : undefined}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={menuPos ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.12 }}
          className="fixed z-50 min-w-[140px] rounded-xl border bg-popover p-1 shadow-lg"
          style={menuPos
            ? { left: menuPos.left, top: menuPos.top }
            : { left: contextMenu.x, top: contextMenu.y, transform: "translate(-50%, -100%) translateY(-4px)", pointerEvents: "none" as const }
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          {contextMenu.entry.detail && (
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => { onDetailView(contextMenu.entry.event_type, contextMenu.entry.detail, formatTime(contextMenu.entry.log_time)); onClose() }}>
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />查看详情
            </button>
          )}
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
            onClick={() => { onEditRequest?.(contextMenu.entry); onClose() }}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />编辑
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
            onClick={() => {
              const text = contextMenu.entry.detail ? `${contextMenu.entry.event_type}\n${contextMenu.entry.detail}` : contextMenu.entry.event_type
              navigator.clipboard.writeText(text)
              toast.success("已复制到剪贴板")
              onClose()
            }}>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />复制内容
          </button>
          {contextMenu.entry.category === "未分类" && (
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => { onAssignCategory(contextMenu.entry.event_type); onClose() }}>
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />分配分类
            </button>
          )}
          <div className="mx-2 my-1 border-t" />
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => { onDeleteRequest(contextMenu.entry.id); onClose() }}>
            <Trash2 className="h-3.5 w-3.5" />删除
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
