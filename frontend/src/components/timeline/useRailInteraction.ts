import { useState, useRef, useEffect, useCallback } from "react"
import { minutesToTime } from "./shared"

interface UseRailInteractionOptions {
  railRef: React.RefObject<HTMLDivElement | null>
  railHeight: number
  onRailCreate?: (time: string) => void
}

export function useRailInteraction({
  railRef,
  railHeight,
  onRailCreate,
}: UseRailInteractionOptions) {
  const [hoverTime, setHoverTime] = useState<string | null>(null)
  const [isTouching, setIsTouching] = useState(false)
  const isTouchingRef = useRef(false)
  const hoverTimeRef = useRef<string | null>(null)

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    hoverTimeRef.current = hoverTime
  }, [hoverTime])

  const handleRailHover = (e: React.MouseEvent) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const y = e.clientY - rect.top
    const pct = Math.max(0, Math.min(1, y / railHeight))
    const totalMins = Math.round(pct * 1440)
    setHoverTime(minutesToTime(totalMins))
  }

  const handleRailClick = () => {
    if (hoverTime) {
      onRailCreate?.(hoverTime)
      setHoverTime(null)
    }
  }

  const getTouchTimeFromNative = useCallback((e: TouchEvent): string | null => {
    const rail = railRef.current
    if (!rail) return null
    const rect = rail.getBoundingClientRect()
    const y = e.touches[0].clientY - rect.top
    const h = rail.clientHeight
    if (h <= 0) return null
    const pct = Math.max(0, Math.min(1, y / h))
    return minutesToTime(Math.round(pct * 1440))
  }, [railRef])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      isTouchingRef.current = true
      setIsTouching(true)
      const time = getTouchTimeFromNative(e)
      if (time) setHoverTime(time)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchingRef.current) return
      e.preventDefault()
      const time = getTouchTimeFromNative(e)
      if (time) setHoverTime(time)
    }
    const onTouchEnd = () => {
      if (!isTouchingRef.current) return
      isTouchingRef.current = false
      setIsTouching(false)
      const lastTime = hoverTimeRef.current
      setHoverTime(null)
      if (lastTime) onRailCreate?.(lastTime)
    }

    rail.addEventListener("touchstart", onTouchStart, { passive: false })
    rail.addEventListener("touchmove", onTouchMove, { passive: false })
    rail.addEventListener("touchend", onTouchEnd)
    rail.addEventListener("touchcancel", onTouchEnd)
    return () => {
      rail.removeEventListener("touchstart", onTouchStart)
      rail.removeEventListener("touchmove", onTouchMove)
      rail.removeEventListener("touchend", onTouchEnd)
      rail.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [getTouchTimeFromNative, onRailCreate, railRef])

  return {
    hoverTime,
    setHoverTime,
    isTouching,
    handleRailHover,
    handleRailClick,
  }
}
