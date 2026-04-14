import { useCallback, useEffect, useState } from "react"

export type NavigationStyle = "auto" | "top" | "floating"

const NAVIGATION_STYLE_KEY = "navigation_style"
const NAVIGATION_STYLE_EVENT = "navigationStyleChange"

function getStoredNavigationStyle(): NavigationStyle | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(NAVIGATION_STYLE_KEY)
  if (stored === "auto" || stored === "top" || stored === "floating") return stored
  return null
}

function getDefaultNavigationStyle(): NavigationStyle {
  return "auto"
}

export function useNavigationStyle() {
  const [navigationStyle, setNavigationStyleState] = useState<NavigationStyle>(() => {
    return getStoredNavigationStyle() ?? getDefaultNavigationStyle()
  })

  useEffect(() => {
    const syncFromStorage = () => {
      setNavigationStyleState(getStoredNavigationStyle() ?? getDefaultNavigationStyle())
    }

    const handleCustomEvent = (event: Event) => {
      const nextStyle = (event as CustomEvent<NavigationStyle>).detail
      if (nextStyle === "auto" || nextStyle === "top" || nextStyle === "floating") {
        setNavigationStyleState(nextStyle)
      } else {
        syncFromStorage()
      }
    }

    window.addEventListener("storage", syncFromStorage)
    window.addEventListener(NAVIGATION_STYLE_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener("storage", syncFromStorage)
      window.removeEventListener(NAVIGATION_STYLE_EVENT, handleCustomEvent)
    }
  }, [])

  const setNavigationStyle = useCallback((style: NavigationStyle) => {
    localStorage.setItem(NAVIGATION_STYLE_KEY, style)
    setNavigationStyleState(style)
    window.dispatchEvent(new CustomEvent<NavigationStyle>(NAVIGATION_STYLE_EVENT, { detail: style }))
  }, [])

  return {
    navigationStyle,
    setNavigationStyle,
    isAutoNavigation: navigationStyle === "auto",
    isTopNavigation: navigationStyle === "top",
    isFloatingNavigation: navigationStyle === "floating",
  }
}
