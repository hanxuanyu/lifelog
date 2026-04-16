package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
)

// GetPrompts 获取所有提示词（内置 + 自定义）
func GetPrompts(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: config.GetAllPrompts()})
}

// CreatePrompt 创建自定义提示词
func CreatePrompt(c *gin.Context) {
	var req model.Prompt
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	if err := config.AddCustomPrompt(req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "创建成功"})
}

// UpdatePrompt 更新自定义提示词
func UpdatePrompt(c *gin.Context) {
	name := c.Param("name")
	var req model.Prompt
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	if err := config.UpdateCustomPrompt(name, req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功"})
}

// DeletePrompt 删除自定义提示词
func DeletePrompt(c *gin.Context) {
	name := c.Param("name")
	if err := config.DeleteCustomPrompt(name); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "删除成功"})
}
