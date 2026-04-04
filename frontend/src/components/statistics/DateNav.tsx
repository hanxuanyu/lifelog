import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DateNavProps {
  onPrev: () => void
  onNext: () => void
  label: string
}

export function DateNav({ onPrev, onNext, label }: DateNavProps) {
  return (
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
}
