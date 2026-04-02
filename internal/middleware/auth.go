package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

// AuthRequired JWT 认证中间件
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 未设置密码时跳过认证
		if !service.IsPasswordSet() {
			c.Next()
			return
		}

		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.Response{
				Code:    401,
				Message: "未提供认证信息",
			})
			return
		}

		token := strings.TrimPrefix(auth, "Bearer ")
		if token == auth {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.Response{
				Code:    401,
				Message: "认证格式错误，请使用 Bearer token",
			})
			return
		}

		if err := service.ValidateToken(token); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, model.Response{
				Code:    401,
				Message: "认证失败: " + err.Error(),
			})
			return
		}

		c.Next()
	}
}
