package ws

import (
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID          string
	Token       string
	Conn        *websocket.Conn
	Send        chan []byte
	Hub         *Hub
	IP          string
	UserAgent   string
	ConnectedAt time.Time
}

type ClientInfo struct {
	ID          string `json:"id"`
	IP          string `json:"ip"`
	UserAgent   string `json:"user_agent"`
	ConnectedAt string `json:"connected_at"`
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			slog.Info("WebSocket 客户端已连接", "id", client.ID, "ip", client.IP)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			slog.Info("WebSocket 客户端已断开", "id", client.ID, "ip", client.IP)
		}
	}
}

func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, client := range h.clients {
		select {
		case client.Send <- msg:
		default:
			// channel full, skip this client
		}
	}
}

func (h *Hub) GetClients() []ClientInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]ClientInfo, 0, len(h.clients))
	for _, c := range h.clients {
		result = append(result, ClientInfo{
			ID:          c.ID,
			IP:          c.IP,
			UserAgent:   c.UserAgent,
			ConnectedAt: c.ConnectedAt.Format(time.RFC3339),
		})
	}
	return result
}

func (h *Hub) DisconnectByID(id string) {
	h.mu.RLock()
	client, ok := h.clients[id]
	h.mu.RUnlock()
	if !ok {
		return
	}
	client.Conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"force_logout"}`))
	client.Conn.Close()
}

func (h *Hub) GetClientByID(id string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clients[id]
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}
