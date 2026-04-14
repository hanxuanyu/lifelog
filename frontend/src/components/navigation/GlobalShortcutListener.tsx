import { useQuickAddShortcut } from "@/hooks/use-shortcut"

export function GlobalShortcutListener() {
  useQuickAddShortcut(() => {
    window.dispatchEvent(new CustomEvent("openQuickAdd"))
  })
  return null
}
