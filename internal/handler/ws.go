package handler

import (
	"net/http"

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

		var tokenID string
		if service.IsPasswordSet() {
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "未提供认证信息"})
				return
			}
			var err error
			tokenID, err = service.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "认证失败: " + err.Error()})
				return
			}
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		clientID := tokenID
		if clientID == "" {
			clientID = uuid.New().String()
		}

		hub.ReconnectOrRegister(clientID, conn, c.ClientIP(), c.Request.UserAgent(), token)

		if tokenID != "" {
			go service.UpdateLastUsed(tokenID)
		}
	}
}
