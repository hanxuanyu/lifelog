import { useEffect, useCallback } from "react"

const STORAGE_KEY = "quickAddShortcut"
const DEFAULT_SHORTCUT = "ctrl+shift+n"

export interface ShortcutConfig {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

export function parseShortcut(shortcut: string): ShortcutConfig {
  const parts = shortcut.toLowerCase().split("+").map((s) => s.trim())
  return {
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    key: parts.filter((p) => !["ctrl", "shift", "alt", "meta", "cmd"].includes(p))[0] || "",
  }
}

export function formatShortcut(shortcut: string): string {
  const config = parseShortcut(shortcut)
  const parts: string[] = []
  if (config.ctrl) parts.push("Ctrl")
  if (config.shift) parts.push("Shift")
  if (config.alt) parts.push("Alt")
  if (config.meta) parts.push("⌘")
  if (config.key) parts.push(config.key.toUpperCase())
  return parts.join(" + ")
}

function matchesShortcut(e: KeyboardEvent, config: ShortcutConfig): boolean {
  return (
    e.ctrlKey === config.ctrl &&
    e.shiftKey === config.shift &&
    e.altKey === config.alt &&
    e.metaKey === config.meta &&
    e.key.toLowerCase() === config.key
  )
}

export function getShortcut(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SHORTCUT
}

export function setShortcut(shortcut: string) {
  localStorage.setItem(STORAGE_KEY, shortcut.toLowerCase())
}

export function useQuickAddShortcut(onTrigger: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const config = parseShortcut(getShortcut())
      if (matchesShortcut(e, config)) {
        e.preventDefault()
        onTrigger()
      }
    },
    [onTrigger]
  )

  useEffect(() => {
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [handler])
}
