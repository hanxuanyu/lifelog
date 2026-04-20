package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/hxuanyu/lifelog/internal/ws"
)

func GetOnlineDevices(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		clients := hub.GetClients()
		c.JSON(http.StatusOK, model.Response{
			Code:    200,
			Message: "success",
			Data:    clients,
		})
	}
}

func DisconnectDevice(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		client := hub.GetClientByID(id)
		if client == nil {
			c.JSON(http.StatusNotFound, model.Response{
				Code:    404,
				Message: "设备不存在或已离线",
			})
			return
		}

		if client.Token != "" {
			service.BlacklistToken(client.Token)
		}
		hub.DisconnectByID(id)

		c.JSON(http.StatusOK, model.Response{
			Code:    200,
			Message: "设备已断开",
		})
	}
}
