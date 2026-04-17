package handler

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

func maskProviderAPIKeys(providers []model.AIProvider) []model.AIProvider {
	masked := make([]model.AIProvider, len(providers))
	for i, p := range providers {
		masked[i] = p
		if len(p.APIKey) > 8 {
			masked[i].APIKey = p.APIKey[:4] + "****" + p.APIKey[len(p.APIKey)-4:]
		} else if p.APIKey != "" {
			masked[i].APIKey = "****"
		}
	}
	return masked
}

func unmaskProviderAPIKey(req model.AIProvider) model.AIProvider {
	if strings.Contains(req.APIKey, "****") && req.Name != "" {
		if stored := config.GetAIProviderByName(req.Name); stored != nil {
			req.APIKey = stored.APIKey
		}
	}
	return req
}

// GetAIProviders 获取 AI 服务提供商列表
// @Summary 获取 AI 服务提供商列表
// @Tags AI
// @Produce json
// @Success 200 {object} model.Response{data=[]model.AIProvider}
// @Router /api/ai/providers [get]
func GetAIProviders(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "ok",
		Data:    maskProviderAPIKeys(config.GetAIProviders()),
	})
}

// AddAIProvider 添加 AI 服务提供商
// @Summary 添加 AI 服务提供商
// @Tags AI
// @Accept json
// @Produce json
// @Param body body model.AIProvider true "提供商信息"
// @Success 200 {object} model.Response
// @Failure 400 {object} model.Response
// @Router /api/ai/providers [post]
func AddAIProvider(c *gin.Context) {
	var req model.AIProvider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Model = strings.TrimSpace(req.Model)

	if req.Name == "" || req.Endpoint == "" || req.Model == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "名称、接口地址和模型不能为空"})
		return
	}

	providers := config.GetAIProviders()
	for _, p := range providers {
		if p.Name == req.Name {
			c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "已存在同名提供商"})
			return
		}
	}

	if req.Default {
		for i := range providers {
			providers[i].Default = false
		}
	}

	providers = append(providers, req)
	if err := config.SetAIProviders(providers); err != nil {
		slog.Error("保存 AI 提供商失败", "error", err, "name", req.Name)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}

	slog.Info("AI 提供商已添加", "name", req.Name, "endpoint", req.Endpoint, "model", req.Model)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "添加成功"})
	go events.Publish("ai.provider.created", map[string]string{"provider_name": req.Name, "timestamp": time.Now().Format(time.RFC3339)})
}

// UpdateAIProvider 更新 AI 服务提供商
// @Summary 更新 AI 服务提供商
// @Tags AI
// @Accept json
// @Produce json
// @Param name path string true "提供商名称"
// @Param body body model.AIProvider true "提供商信息"
// @Success 200 {object} model.Response
// @Failure 400,404 {object} model.Response
// @Router /api/ai/providers/{name} [put]
func UpdateAIProvider(c *gin.Context) {
	name := c.Param("name")
	var req model.AIProvider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	req = unmaskProviderAPIKey(req)
	req.Name = name
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Model = strings.TrimSpace(req.Model)
	if req.Endpoint == "" || req.Model == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "接口地址和模型不能为空"})
		return
	}

	providers := config.GetAIProviders()
	found := false
	if req.Default {
		for i := range providers {
			providers[i].Default = false
		}
	}

	for i, p := range providers {
		if p.Name != name {
			continue
		}
		found = true
		req.Name = p.Name
		providers[i] = req
		break
	}

	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "提供商不存在"})
		return
	}

	if err := config.SetAIProviders(providers); err != nil {
		slog.Error("更新 AI 提供商失败", "error", err, "name", name)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}

	slog.Info("AI 提供商已更新", "name", name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功"})
	go events.Publish("ai.provider.updated", map[string]string{"provider_name": name, "timestamp": time.Now().Format(time.RFC3339)})
}

// DeleteAIProvider 删除 AI 服务提供商
// @Summary 删除 AI 服务提供商
// @Tags AI
// @Produce json
// @Param name path string true "提供商名称"
// @Success 200 {object} model.Response
// @Failure 404 {object} model.Response
// @Router /api/ai/providers/{name} [delete]
func DeleteAIProvider(c *gin.Context) {
	name := c.Param("name")
	providers := config.GetAIProviders()
	next := make([]model.AIProvider, 0, len(providers))
	found := false
	deletedDefault := false

	for _, p := range providers {
		if p.Name == name {
			found = true
			deletedDefault = p.Default
			continue
		}
		next = append(next, p)
	}

	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "提供商不存在"})
		return
	}

	if deletedDefault && len(next) > 0 {
		hasDefault := false
		for _, p := range next {
			if p.Default {
				hasDefault = true
				break
			}
		}
		if !hasDefault {
			next[0].Default = true
		}
	}

	if err := config.SetAIProviders(next); err != nil {
		slog.Error("删除 AI 提供商失败", "error", err, "name", name)
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}

	if deletedDefault {
		if len(next) == 0 {
			if err := config.SetAIDefaultModel(""); err != nil {
				slog.Warn("清空 AI 默认模型失败", "error", err)
			}
		} else {
			nextDefaultModel := strings.TrimSpace(next[0].Model)
			for _, provider := range next {
				if provider.Default {
					nextDefaultModel = strings.TrimSpace(provider.Model)
					break
				}
			}
			if err := config.SetAIDefaultModel(nextDefaultModel); err != nil {
				slog.Warn("重置 AI 默认模型失败", "error", err, "model", nextDefaultModel)
			}
		}
	}

	slog.Info("AI 提供商已删除", "name", name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "删除成功"})
	go events.Publish("ai.provider.deleted", map[string]string{"provider_name": name, "timestamp": time.Now().Format(time.RFC3339)})
}

// TestAIProvider 测试 AI 服务提供商连接
// @Summary 测试 AI 服务提供商连接
// @Tags AI
// @Accept json
// @Produce json
// @Param body body model.AIProvider true "提供商信息"
// @Success 200 {object} model.Response
// @Router /api/ai/providers/test [post]
func TestAIProvider(c *gin.Context) {
	var req model.AIProvider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	req = unmaskProviderAPIKey(req)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Model = strings.TrimSpace(req.Model)

	if err := service.TestProvider(req); err != nil {
		slog.Warn("AI 提供商连接测试失败", "name", req.Name, "endpoint", req.Endpoint, "error", err)
		c.JSON(http.StatusOK, model.Response{Code: 500, Message: "连接失败: " + err.Error()})
		return
	}

	slog.Info("AI 提供商连接测试成功", "name", req.Name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "连接成功"})
}

// FetchModels 获取 AI 提供商的可用模型列表
// @Summary 获取 AI 提供商的可用模型列表
// @Tags AI
// @Accept json
// @Produce json
// @Param body body model.FetchModelsRequest true "提供商接口信息"
// @Success 200 {object} model.Response{data=[]string}
// @Router /api/ai/models [post]
func FetchModels(c *gin.Context) {
	var req model.FetchModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if strings.Contains(req.APIKey, "****") && req.Name != "" {
		if stored := config.GetAIProviderByName(req.Name); stored != nil {
			req.APIKey = stored.APIKey
		}
	}

	models, err := service.FetchModels(req.Endpoint, req.APIKey)
	if err != nil {
		slog.Warn("获取模型列表失败", "endpoint", req.Endpoint, "error", err)
		c.JSON(http.StatusOK, model.Response{Code: 500, Message: "获取模型列表失败: " + err.Error()})
		return
	}

	slog.Debug("获取模型列表成功", "endpoint", req.Endpoint, "count", len(models))
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: models})
}

// AIChat AI 流式对话
// @Summary AI 流式对话（SSE）
// @Tags AI
// @Accept json
// @Produce text/event-stream
// @Param body body model.AIChatRequest true "对话请求"
// @Success 200 {string} string "SSE 流式响应"
// @Failure 400 {object} model.Response
// @Router /api/ai/chat [post]
func AIChat(c *gin.Context) {
	var req model.AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	var provider *model.AIProvider
	if req.ProviderName != "" {
		provider = config.GetAIProviderByName(req.ProviderName)
	} else {
		provider = config.GetDefaultAIProvider()
	}
	if provider == nil {
		slog.Warn("AI 对话失败: 未配置提供商")
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "未配置 AI 服务提供商"})
		return
	}

	if modelName := strings.TrimSpace(req.Model); modelName != "" {
		provider.Model = modelName
	} else if req.ProviderName == "" {
		if defaultModel := config.GetDefaultAIModel(); defaultModel != "" {
			provider.Model = defaultModel
		}
	}

	slog.Info("AI 对话请求", "provider", provider.Name, "model", provider.Model, "start", req.StartDate, "end", req.EndDate)

	logContext, err := service.BuildLogContext(req.StartDate, req.EndDate, req.Categories)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	systemPrompt := fmt.Sprintf(`你是一个生活日志分析助手。用户会提供一段时间内的活动日志数据，请根据用户的问题对这些数据进行分析和总结。
请用中文回答，使用 Markdown 格式输出。

%s`, logContext)

	if req.SystemPrompt != "" {
		systemPrompt = fmt.Sprintf("%s\n\n用户自定义指令：\n%s", systemPrompt, req.SystemPrompt)
	}

	messages := make([]model.AIChatMessage, len(req.History))
	copy(messages, req.History)
	messages = append(messages, model.AIChatMessage{Role: "user", Content: req.Message})

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	writer := c.Writer
	flusher, _ := writer.(http.Flusher)
	if err := service.StreamChat(*provider, systemPrompt, messages, writer, flusher); err != nil {
		errData := fmt.Sprintf(`data: {"error": %q}`, err.Error())
		fmt.Fprintf(writer, "%s\n\n", errData)
		if flusher != nil {
			flusher.Flush()
		}
	}
}
