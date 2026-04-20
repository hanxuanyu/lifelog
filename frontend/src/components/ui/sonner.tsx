import React, { useEffect } from "react"
import { Toaster as Sonner, type ToasterProps, useSonner } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

const MOBILE_TOAST_LIFT_VAR = "--mobile-toast-lift"

function setMobileToastLift(value: number) {
  if (typeof document === "undefined") return
  document.documentElement.style.setProperty(MOBILE_TOAST_LIFT_VAR, `${Math.max(0, Math.round(value))}px`)
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDark } = useTheme()
  const { toasts } = useSonner()
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640

  useEffect(() => {
    if (typeof window === "undefined") return

    let rafPending = false

    const scheduleUpdate = () => {
      if (rafPending) return
      rafPending = true
      window.requestAnimationFrame(() => {
        rafPending = false
        updateLift()
      })
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)

    const observeVisibleToasts = () => {
      resizeObserver.disconnect()
      document
        .querySelectorAll<HTMLElement>("[data-sonner-toast][data-visible='true']")
        .forEach((toast) => resizeObserver.observe(toast))
    }

    const updateLift = () => {
      if (window.innerWidth >= 640) {
        setMobileToastLift(0)
        return
      }

      const visibleToasts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sonner-toast][data-visible='true']")
      )

      if (visibleToasts.length === 0) {
        setMobileToastLift(0)
        return
      }

      let minTop = Number.POSITIVE_INFINITY
      let maxBottom = 0

      visibleToasts.forEach((toast) => {
        const rect = toast.getBoundingClientRect()
        if (rect.height <= 0) return
        minTop = Math.min(minTop, rect.top)
        maxBottom = Math.max(maxBottom, rect.bottom)
      })

      if (!Number.isFinite(minTop) || maxBottom <= minTop) {
        setMobileToastLift(0)
        return
      }

      setMobileToastLift(maxBottom - minTop + 12)
    }

    // MutationObserver to detect toast DOM additions/removals
    const mutationObserver = new MutationObserver(() => {
      observeVisibleToasts()
      scheduleUpdate()
    })
    const toaster = document.querySelector("[data-sonner-toaster]")
    if (toaster) {
      mutationObserver.observe(toaster, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-visible"] })
    }

    // visualViewport listener for soft keyboard / address bar changes
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener("resize", scheduleUpdate)
    }

    // Safety interval: force reset when no visible toasts
    const safetyInterval = window.setInterval(() => {
      const count = document.querySelectorAll("[data-sonner-toast][data-visible='true']").length
      if (count === 0) setMobileToastLift(0)
    }, 500)

    observeVisibleToasts()
    const frameId = window.requestAnimationFrame(updateLift)
    window.addEventListener("resize", updateLift, { passive: true })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", updateLift)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      if (vv) vv.removeEventListener("resize", scheduleUpdate)
      window.clearInterval(safetyInterval)
      setMobileToastLift(0)
    }
  }, [toasts])

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      position={isMobile ? "bottom-center" : "bottom-left"}
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast group",
          closeButton: "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
