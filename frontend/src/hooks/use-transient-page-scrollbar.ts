import { useEffect } from "react"

const PAGE_SCROLLBAR_CLASS = "page-scrollbars"
const PAGE_SCROLLING_CLASS = "page-is-scrolling"

export function useTransientPageScrollbar() {
  useEffect(() => {
    let timeoutId = 0

    const showScrollbar = () => {
      document.body.classList.add(PAGE_SCROLLBAR_CLASS, PAGE_SCROLLING_CLASS)
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        document.body.classList.remove(PAGE_SCROLLING_CLASS)
      }, 700)
    }

    document.body.classList.add(PAGE_SCROLLBAR_CLASS)
    window.addEventListener("scroll", showScrollbar, { passive: true })

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("scroll", showScrollbar)
      document.body.classList.remove(PAGE_SCROLLBAR_CLASS, PAGE_SCROLLING_CLASS)
    }
  }, [])
}
