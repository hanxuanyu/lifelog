package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/hxuanyu/lifelog/internal/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func HandleWebSocket(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")

		if service.IsPasswordSet() {
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "未提供认证信息"})
				return
			}
			if err := service.ValidateToken(token); err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "认证失败"})
				return
			}
			if service.IsTokenBlacklisted(token) {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "token已失效"})
				return
			}
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &ws.Client{
			ID:          uuid.New().String(),
			Token:       token,
			Conn:        conn,
			Send:        make(chan []byte, 256),
			Hub:         hub,
			IP:          c.ClientIP(),
			UserAgent:   c.Request.UserAgent(),
			ConnectedAt: time.Now(),
		}

		hub.Register(client)
		go client.WritePump()
		go client.ReadPump()
	}
}
