package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

// GetSystemMonitor 获取服务器资源监控信息
// @Summary 获取服务器资源监控
// @Tags 系统
// @Produce json
// @Success 200 {object} model.Response{data=model.SystemMonitor}
// @Router /api/system/monitor [get]
func GetSystemMonitor(c *gin.Context) {
	monitor := service.GetSystemMonitor()
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: monitor})
}
