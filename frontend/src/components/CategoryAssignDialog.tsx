import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCategories, updateCategories } from "@/api"
import type { Category } from "@/types"
import { toast } from "sonner"
import { Plus, Loader2, Check } from "lucide-react"

interface CategoryAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventType: string
  onAssigned?: () => void
}

export function CategoryAssignDialog({
  open,
  onOpenChange,
  eventType,
  onAssigned,
}: CategoryAssignDialogProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#6b7280")

  useEffect(() => {
    if (open) {
      setSelectedIndex(null)
      setIsCreating(false)
      setNewName("")
      setNewColor("#6b7280")
      setLoading(true)
      getCategories()
        .then((cats) => setCategories(cats || []))
        .catch(() => setCategories([]))
        .finally(() => setLoading(false))
    }
  }, [open])

  const canConfirm = isCreating ? newName.trim().length > 0 : selectedIndex !== null

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const updated = categories.map((c) => ({
        ...c,
        rules: c.rules.map((r) => ({ ...r })),
      }))

      let categoryName: string

      if (isCreating && newName.trim()) {
        categoryName = newName.trim()
        updated.push({
          name: categoryName,
          color: newColor,
          rules: [{ type: "fixed" as const, pattern: eventType }],
        })
      } else if (!isCreating && selectedIndex !== null) {
        const cat = updated[selectedIndex]
        const alreadyExists = cat.rules.some(
          (r) => r.type === "fixed" && r.pattern === eventType
        )
        if (!alreadyExists) {
          cat.rules.push({ type: "fixed" as const, pattern: eventType })
        }
        categoryName = cat.name
      } else {
        return
      }

      await updateCategories(updated)
      toast.success("分类已更新", {
        description: `"${eventType}" 已归入「${categoryName}」`,
      })
      onOpenChange(false)
      onAssigned?.()
    } catch {
      toast.error("保存分类失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            为「{eventType}」选择分类
          </DialogTitle>
          <DialogDescription>
            选择一个已有分类，或新建分类
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[50vh] -mx-1 px-1 space-y-1.5">
            {/* Create new category option */}
            <button
              type="button"
              onClick={() => {
                setIsCreating(true)
                setSelectedIndex(null)
              }}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left ${
                isCreating
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-dashed border-muted-foreground/30 hover:bg-accent"
              }`}
            >
              <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center bg-muted">
                <Plus className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium flex-1 text-muted-foreground">
                新建分类
              </span>
              {isCreating && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>

            {/* Inline create form when selected */}
            {isCreating && (
              <div className="flex items-center gap-2 pl-2 pb-1">
                <div className="relative w-7 h-7 shrink-0">
                  <div
                    className="w-7 h-7 rounded-md border border-input shadow-sm"
                    style={{ backgroundColor: newColor }}
                  />
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入分类名称"
                  className="flex-1 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm) {
                      e.preventDefault()
                      handleConfirm()
                    }
                  }}
                />
              </div>
            )}

            {/* Existing categories */}
            {categories.map((cat, i) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  setSelectedIndex(i)
                  setIsCreating(false)
                }}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left ${
                  !isCreating && selectedIndex === i
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm font-medium flex-1">
                  {cat.name}
                </span>
                {!isCreating && selectedIndex === i && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {cat.rules.length} 条规则
                </span>
              </button>
            ))}

            {categories.length === 0 && !isCreating && (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无分类，请新建一个分类
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "确认"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
