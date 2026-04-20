import { useEffect } from "react"
import { onWSMessage } from "./use-websocket"
import type { WSMessage } from "./use-websocket"

const eventMap: Record<string, string> = {
  "log.created": "logCreated",
  "log.updated": "logCreated",
  "log.deleted": "logCreated",
  "categories.updated": "categoriesUpdated",
  "settings.updated": "settingsUpdated",
}

export function useRealtimeSync() {
  useEffect(() => {
    return onWSMessage((msg: WSMessage) => {
      if (msg.type !== "event" || !msg.event) return
      const domEvent = eventMap[msg.event]
      if (domEvent) {
        window.dispatchEvent(new CustomEvent(domEvent))
      }
    })
  }, [])
}
