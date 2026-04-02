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

// UpdateCategories 更新大类配置（热重载生效）
// @Summary 更新分类规则
// @Tags 大类
// @Accept json
// @Produce json
// @Param categories body []model.Category true "分类列表"
// @Success 200 {object} model.Response
// @Router /api/categories [put]
func UpdateCategories(c *gin.Context) {
	var cats []model.Category
	if err := c.ShouldBindJSON(&cats); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数格式错误: " + err.Error()})
		return
	}
	if err := config.SetCategoriesConfig(cats); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "分类规则已更新（已热重载）"})
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
		"server":          config.GetServerConfig(),
		"auth":            config.GetAuthConfig(),
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: settings})
}

// UpdateSettings 更新配置
// @Summary 更新系统配置
// @Tags 设置
// @Accept json
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/settings [put]
func UpdateSettings(c *gin.Context) {
	var req struct {
		TimePointMode  *string `json:"time_point_mode"`
		ServerPort     *int    `json:"server_port"`
		ServerDBPath   *string `json:"server_db_path"`
		JWTExpireHours *int    `json:"jwt_expire_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数格式错误: " + err.Error()})
		return
	}

	needRestart := false

	// 时间点模式（热重载）
	if req.TimePointMode != nil {
		if err := config.SetTimePointMode(*req.TimePointMode); err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
			return
		}
	}

	// 服务器配置（需重启）
	if req.ServerPort != nil || req.ServerDBPath != nil {
		port := 0
		dbPath := ""
		if req.ServerPort != nil {
			port = *req.ServerPort
			needRestart = true
		}
		if req.ServerDBPath != nil {
			dbPath = *req.ServerDBPath
			needRestart = true
		}
		if err := config.SetServerConfig(port, dbPath); err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
			return
		}
	}

	// JWT 过期时间（需重启）
	if req.JWTExpireHours != nil {
		needRestart = true
		if err := config.SetAuthConfig(*req.JWTExpireHours); err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
			return
		}
	}

	msg := "配置已保存"
	if needRestart {
		msg = "配置已保存，部分设置需要重启服务后生效"
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: msg, Data: map[string]bool{"need_restart": needRestart}})
}
