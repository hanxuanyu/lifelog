import type { useNavigate } from "react-router-dom"

export function navigateWithReplace(navigate: ReturnType<typeof useNavigate>, isHome: boolean, path: string) {
  if (path === "/") {
    navigate(path, { replace: true })
    return
  }

  navigate(path, { replace: !isHome })
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone
}
