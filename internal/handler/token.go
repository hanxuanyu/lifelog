package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/hxuanyu/lifelog/internal/ws"
)

type CreateAPITokenRequest struct {
	Name           string `json:"name" binding:"required"`
	ExpiresInHours *int   `json:"expires_in_hours"`
}

func GetTokens(c *gin.Context) {
	tokens, err := service.GetAllTokens()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "获取令牌列表失败"})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "success", Data: tokens})
}

func CreateAPIToken(c *gin.Context) {
	var req CreateAPITokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	rawToken, tokenInfo, err := service.GenerateAPIToken(req.Name, req.ExpiresInHours, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "创建失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "创建成功",
		Data: gin.H{
			"token": rawToken,
			"info":  tokenInfo,
		},
	})
}

func RevokeTokenHandler(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := service.RevokeToken(id); err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "吊销失败"})
			return
		}
		hub.DisconnectByID(id)
		c.JSON(http.StatusOK, model.Response{Code: 200, Message: "令牌已吊销"})
	}
}

func RevokeAllTokens(hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentID, _ := c.Get("token_id")
		currentIDStr, _ := currentID.(string)
		if err := service.RevokeAllExcept(currentIDStr); err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "吊销失败"})
			return
		}
		clients := hub.GetClients()
		for _, client := range clients {
			if client.ID != currentIDStr {
				hub.DisconnectByID(client.ID)
			}
		}
		c.JSON(http.StatusOK, model.Response{Code: 200, Message: "已吊销所有其他令牌"})
	}
}
