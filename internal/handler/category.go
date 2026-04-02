package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
)

// GetCategories 获取大类配置（只读）
// @Summary 获取所有大类及其匹配规则
// @Tags 大类
// @Produce json
// @Success 200 {object} model.Response{data=[]model.Category}
// @Router /api/categories [get]
func GetCategories(c *gin.Context) {
	categories := config.GetCategories()
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: categories})
}

// GetSettings 获取公开配置
// @Summary 获取系统配置
// @Tags 设置
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/settings [get]
func GetSettings(c *gin.Context) {
	settings := map[string]interface{}{
		"time_point_mode": config.GetTimePointMode(),
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: settings})
}
