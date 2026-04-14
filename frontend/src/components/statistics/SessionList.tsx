import { useState } from "react"
import { Check, Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ChatSession } from "./ai-chat-shared"
import { formatSessionTime } from "./ai-chat-shared"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      title="复制"
      type="button"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  )
}

interface SessionListProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onOpen: (session: ChatSession) => void
  onDelete: (session: ChatSession) => void
  onNew: () => void
  className?: string
}

export function SessionList({ sessions, currentSessionId, onOpen, onDelete, onNew, className }: SessionListProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div>
          <div className="text-sm font-medium">历史会话</div>
          <div className="text-xs text-muted-foreground">支持打开、继续和删除</div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          新会话
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              还没有保存的 AI 会话
            </div>
          ) : (
            sessions.map((session) => {
              const active = session.id === currentSessionId
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                    active ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(session)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{session.title}</span>
                      {active && <Badge variant="secondary" className="h-5 text-[10px]">当前</Badge>}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{session.preview}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{session.provider_name || "默认服务商"}</span>
                      <span className="font-mono">{session.model}</span>
                      <span>{session.start_date} ~ {session.end_date}</span>
                      <span>{formatSessionTime(session.updated_at)}</span>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(session)}
                    title={`删除 ${session.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
