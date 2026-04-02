import type { Category } from "@/types"

export interface EditState {
  id: number
  time: string
  event: string
  detail: string
}

export interface QuickCreateState {
  time: string
  event: string
  detail: string
}

export const DEFAULT_COLORS: Record<string, string> = {
  工作: "#3b82f6",
  学习: "#10b981",
  生活: "#f59e0b",
  娱乐: "#8b5cf6",
  运动: "#ef4444",
  休息: "#06b6d4",
  社交: "#ec4899",
  未分类: "#9ca3af",
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(Math.max(0, Math.min(1439, minutes)) / 60)
  const m = Math.max(0, Math.min(1439, minutes)) % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function getCategoryColorFn(
  category: string,
  categories?: Category[]
): string {
  if (categories) {
    const cat = categories.find((c) => c.name === category)
    if (cat?.color) return cat.color
  }
  return DEFAULT_COLORS[category] || DEFAULT_COLORS["未分类"]
}
