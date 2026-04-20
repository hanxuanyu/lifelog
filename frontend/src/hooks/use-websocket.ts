export interface WSMessage {
  type: string
  event?: string
  data?: Record<string, string>
}

type WSListener = (msg: WSMessage) => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<WSListener>()
let intentionalClose = false

function buildWSUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  const token = localStorage.getItem("token")
  const base = `${proto}//${location.host}/api/ws`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWebSocket()
  }, 3000)
}

export function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  intentionalClose = false

  try {
    ws = new WebSocket(buildWSUrl())
  } catch {
    scheduleReconnect()
    return
  }

  ws.onmessage = (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data)
      if (msg.type === "force_logout") {
        intentionalClose = true
        localStorage.removeItem("token")
        location.reload()
        return
      }
      listeners.forEach((fn) => fn(msg))
    } catch {
      // ignore parse errors
    }
  }

  ws.onclose = (event) => {
    ws = null
    if (event.code === 4401) {
      localStorage.removeItem("token")
      location.reload()
      return
    }
    if (!intentionalClose) {
      scheduleReconnect()
    }
  }

  ws.onerror = () => {
    ws?.close()
  }
}

export function disconnectWebSocket() {
  intentionalClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
}

export function onWSMessage(fn: WSListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
