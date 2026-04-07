package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/version"
)

// GetVersion 获取版本信息
func GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "ok",
		Data: gin.H{
			"version": version.Version,
			"commit":  version.CommitHash,
		},
	})
}
