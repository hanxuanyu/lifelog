import { useRef, useState, useEffect } from "react"
import type { LogEntry } from "@/types"
import { toast } from "sonner"
import { SWIPE_ACTION_WIDTH } from "./shared"

interface UseCardGesturesOptions {
  expandedEntryId: number | null
  onEditRequest?: (entry: LogEntry) => void
  onExpandToggle: (entryId: number) => void
  onContextMenu: (entry: LogEntry, x: number, y: number) => void
}

export function useCardGestures({
  expandedEntryId,
  onEditRequest,
  onExpandToggle,
  onContextMenu,
}: UseCardGesturesOptions) {
  const [swipedEntryId, setSwipedEntryId] = useState<number | null>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const swipeXRef = useRef(0)
  const swipingRef = useRef(false)
  const swipeActionsRef = useRef<HTMLDivElement | null>(null)

  // Close swiped card on scroll
  useEffect(() => {
    if (swipedEntryId === null) return
    const close = () => setSwipedEntryId(null)
    window.addEventListener("scroll", close, true)
    return () => window.removeEventListener("scroll", close, true)
  }, [swipedEntryId])

  const handleCardClick = (entry: LogEntry) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      toast("编辑此记录？", {
        action: { label: "编辑", onClick: () => onEditRequest?.(entry) },
        duration: 3000,
      })
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        if (entry.detail) onExpandToggle(entry.id)
      }, 250)
    }
  }

  const handleCardTouchStart = (e: React.TouchEvent, entry: LogEntry) => {
    longPressFiredRef.current = false
    swipingRef.current = false
    swipeXRef.current = 0
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    if (swipedEntryId !== null && swipedEntryId !== entry.id) {
      setSwipedEntryId(null)
    }
    const target = e.target as HTMLElement
    if (expandedEntryId === entry.id && target.closest('.prose-compact')) return
    const card = e.currentTarget as HTMLElement

    const onNativeTouchMove = (ev: TouchEvent) => {
      if (swipingRef.current && ev.cancelable) ev.preventDefault()
    }
    card.addEventListener("touchmove", onNativeTouchMove, { passive: false })
    const cleanup = () => {
      card.removeEventListener("touchmove", onNativeTouchMove)
      card.removeEventListener("touchend", cleanup)
      card.removeEventListener("touchcancel", cleanup)
    }
    card.addEventListener("touchend", cleanup)
    card.addEventListener("touchcancel", cleanup)

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      const rect = card.getBoundingClientRect()
      onContextMenu(entry, rect.left + rect.width / 2, rect.top)
      if (navigator.vibrate) navigator.vibrate(10)
    }, 500)
  }

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return
    const touch = e.touches[0]
    const rawDx = touch.clientX - touchStartPos.current.x
    const dx = Math.abs(rawDx)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)

    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    if (!swipingRef.current && dx > 15 && dx > dy * 1.5 && window.innerWidth < 640) {
      swipingRef.current = true
      swipeActionsRef.current = e.currentTarget.parentElement?.querySelector('[data-swipe-actions]') as HTMLDivElement | null
    }

    if (swipingRef.current && swipeActionsRef.current) {
      let offset = rawDx
      const isOpen = swipeActionsRef.current.dataset.open === "true"
      if (isOpen) offset = offset - SWIPE_ACTION_WIDTH
      if (offset < -SWIPE_ACTION_WIDTH) {
        offset = -SWIPE_ACTION_WIDTH - (Math.abs(offset) - SWIPE_ACTION_WIDTH) * 0.2
      }
      if (offset > 0) offset = 0
      swipeXRef.current = offset
      const btnTranslate = SWIPE_ACTION_WIDTH + offset
      swipeActionsRef.current.style.transform = `translateX(${btnTranslate}px)`
      swipeActionsRef.current.style.transition = "none"
      const progress = Math.min(Math.abs(offset) / SWIPE_ACTION_WIDTH, 1)
      swipeActionsRef.current.style.opacity = `${progress}`
    }
  }

  const handleCardTouchEnd = (entry: LogEntry) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (swipingRef.current && swipeActionsRef.current) {
      const threshold = SWIPE_ACTION_WIDTH * 0.4
      const transition = "transform 0.2s ease-out, opacity 0.2s ease-out"
      if (swipeXRef.current < -threshold) {
        swipeActionsRef.current.style.transform = "translateX(0)"
        swipeActionsRef.current.style.opacity = "1"
        swipeActionsRef.current.style.transition = transition
        swipeActionsRef.current.dataset.open = "true"
        setSwipedEntryId(entry.id)
      } else {
        swipeActionsRef.current.style.transform = `translateX(${SWIPE_ACTION_WIDTH}px)`
        swipeActionsRef.current.style.opacity = "0"
        swipeActionsRef.current.style.transition = transition
        swipeActionsRef.current.dataset.open = "false"
        if (swipedEntryId === entry.id) setSwipedEntryId(null)
      }
    }
    touchStartPos.current = null
    swipingRef.current = false
    swipeActionsRef.current = null
  }

  return {
    swipedEntryId,
    setSwipedEntryId,
    handleCardClick,
    handleCardTouchStart,
    handleCardTouchMove,
    handleCardTouchEnd,
  }
}
