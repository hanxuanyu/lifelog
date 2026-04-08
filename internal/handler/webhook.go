package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
)

// GetWebhooks 获取所有 webhook 配置
// @Summary 获取 webhook 列表
// @Tags Webhook
// @Produce json
// @Success 200 {object} model.Response{data=[]model.Webhook}
// @Router /api/webhooks [get]
func GetWebhooks(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: config.GetWebhooks()})
}

// CreateWebhook 创建 webhook
// @Summary 创建 webhook
// @Tags Webhook
// @Accept json
// @Produce json
// @Param body body model.Webhook true "Webhook 配置"
// @Success 200 {object} model.Response
// @Router /api/webhooks [post]
func CreateWebhook(c *gin.Context) {
	var req model.Webhook
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	if req.Name == "" || req.URL == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "name 和 url 为必填项"})
		return
	}
	if config.GetWebhookByName(req.Name) != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "webhook 名称已存在: " + req.Name})
		return
	}

	all := config.GetWebhooks()
	all = append(all, req)
	if err := config.SetWebhooks(all); err != nil {
		slog.Error("创建 webhook 失败", "error", err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	slog.Info("webhook 已创建", "name", req.Name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "创建成功"})
}

// UpdateWebhook 更新 webhook
// @Summary 更新 webhook
// @Tags Webhook
// @Accept json
// @Produce json
// @Param name path string true "Webhook 名称"
// @Param body body model.Webhook true "Webhook 配置"
// @Success 200 {object} model.Response
// @Router /api/webhooks/{name} [put]
func UpdateWebhook(c *gin.Context) {
	name := c.Param("name")
	var req model.Webhook
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	if req.URL == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "url 为必填项"})
		return
	}

	all := config.GetWebhooks()
	found := false
	for i, w := range all {
		if w.Name == name {
			req.Name = name // 名称不可变
			all[i] = req
			found = true
			break
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "webhook 不存在: " + name})
		return
	}
	if err := config.SetWebhooks(all); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	slog.Info("webhook 已更新", "name", name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功"})
}

// DeleteWebhook 删除 webhook
// @Summary 删除 webhook
// @Tags Webhook
// @Produce json
// @Param name path string true "Webhook 名称"
// @Success 200 {object} model.Response
// @Router /api/webhooks/{name} [delete]
func DeleteWebhook(c *gin.Context) {
	name := c.Param("name")
	all := config.GetWebhooks()
	filtered := make([]model.Webhook, 0, len(all))
	found := false
	for _, w := range all {
		if w.Name == name {
			found = true
			continue
		}
		filtered = append(filtered, w)
	}
	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "webhook 不存在: " + name})
		return
	}
	if err := config.SetWebhooks(filtered); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	slog.Info("webhook 已删除", "name", name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "删除成功"})
}

// TestWebhook 测试 webhook（使用示例数据同步执行）
// @Summary 测试 webhook
// @Tags Webhook
// @Produce json
// @Param name path string true "Webhook 名称"
// @Success 200 {object} model.Response
// @Router /api/webhooks/{name}/test [post]
func TestWebhook(c *gin.Context) {
	name := c.Param("name")
	wh := config.GetWebhookByName(name)
	if wh == nil {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "webhook 不存在: " + name})
		return
	}
	// 使用第一个绑定此 webhook 的事件的示例数据，否则用空数据
	sampleData := map[string]string{"test": "true"}
	for _, b := range config.GetEventBindings() {
		if b.WebhookName == name {
			sampleData = events.GetSampleData(b.Event)
			break
		}
	}
	if err := events.ExecuteWebhook(*wh, sampleData); err != nil {
		c.JSON(http.StatusOK, model.Response{Code: 500, Message: "测试失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "测试成功"})
}

// GetEvents 获取所有事件定义（含变量信息）
// @Summary 获取事件定义列表
// @Tags 事件
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/events [get]
func GetEvents(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: events.Registry})
}

// GetEventBindings 获取所有事件绑定
// @Summary 获取事件绑定列表
// @Tags 事件
// @Produce json
// @Success 200 {object} model.Response{data=[]model.EventBinding}
// @Router /api/event-bindings [get]
func GetEventBindings(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: config.GetEventBindings()})
}

// UpdateEventBindings 更新所有事件绑定
// @Summary 更新事件绑定
// @Tags 事件
// @Accept json
// @Produce json
// @Param body body []model.EventBinding true "事件绑定列表"
// @Success 200 {object} model.Response
// @Router /api/event-bindings [put]
func UpdateEventBindings(c *gin.Context) {
	var bindings []model.EventBinding
	if err := c.ShouldBindJSON(&bindings); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	if err := config.SetEventBindings(bindings); err != nil {
		slog.Error("更新事件绑定失败", "error", err)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	slog.Info("事件绑定已更新", "count", len(bindings))
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功"})
}