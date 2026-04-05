package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

// GetAIProviders 获取AI服务提供商列表
// @Summary 获取AI服务提供商列表
// @Tags AI
// @Produce json
// @Success 200 {object} model.Response{data=[]model.AIProvider}
// @Router /api/ai/providers [get]
func GetAIProviders(c *gin.Context) {
	providers := config.GetAIProviders()
	// 掩码 API Key
	masked := make([]model.AIProvider, len(providers))
	for i, p := range providers {
		masked[i] = p
		if len(p.APIKey) > 8 {
			masked[i].APIKey = p.APIKey[:4] + "****" + p.APIKey[len(p.APIKey)-4:]
		} else if p.APIKey != "" {
			masked[i].APIKey = "****"
		}
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: masked})
}

// AddAIProvider 添加AI服务提供商
// @Summary 添加AI服务提供商
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
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "添加成功"})
}

// UpdateAIProvider 更新AI服务提供商
// @Summary 更新AI服务提供商
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

	providers := config.GetAIProviders()
	found := false
	for i, p := range providers {
		if p.Name == name {
			found = true
			if req.Default {
				for j := range providers {
					providers[j].Default = false
				}
			}
			// 如果 API Key 包含掩码标记，保留原始 Key
			if strings.Contains(req.APIKey, "****") {
				req.APIKey = p.APIKey
			}
			req.Name = name // 名称不可变
			providers[i] = req
			break
		}
	}
	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "提供商不存在"})
		return
	}
	if err := config.SetAIProviders(providers); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功"})
}

// DeleteAIProvider 删除AI服务提供商
// @Summary 删除AI服务提供商
// @Tags AI
// @Produce json
// @Param name path string true "提供商名称"
// @Success 200 {object} model.Response
// @Failure 404 {object} model.Response
// @Router /api/ai/providers/{name} [delete]
func DeleteAIProvider(c *gin.Context) {
	name := c.Param("name")
	providers := config.GetAIProviders()
	newProviders := make([]model.AIProvider, 0, len(providers))
	found := false
	for _, p := range providers {
		if p.Name == name {
			found = true
			continue
		}
		newProviders = append(newProviders, p)
	}
	if !found {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "提供商不存在"})
		return
	}
	if err := config.SetAIProviders(newProviders); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "保存失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "删除成功"})
}

// TestAIProvider 测试AI服务提供商连接
// @Summary 测试AI服务提供商连接
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
	// 如果 API Key 包含掩码标记，从配置中查找真实 Key
	if strings.Contains(req.APIKey, "****") && req.Name != "" {
		for _, p := range config.GetAIProviders() {
			if p.Name == req.Name {
				req.APIKey = p.APIKey
				break
			}
		}
	}
	if err := service.TestProvider(req); err != nil {
		c.JSON(http.StatusOK, model.Response{Code: 500, Message: "连接失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "连接成功"})
}

// FetchModels 获取AI提供商的可用模型列表
// @Summary 获取AI提供商的可用模型列表
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
	// 如果 API Key 包含掩码标记，从配置中查找真实 Key
	if strings.Contains(req.APIKey, "****") && req.Name != "" {
		for _, p := range config.GetAIProviders() {
			if p.Name == req.Name {
				req.APIKey = p.APIKey
				break
			}
		}
	}
	models, err := service.FetchModels(req.Endpoint, req.APIKey)
	if err != nil {
		c.JSON(http.StatusOK, model.Response{Code: 500, Message: "获取模型列表失败: " + err.Error()})
		return
	}
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

	// 获取提供商
	var provider *model.AIProvider
	if req.ProviderName != "" {
		for _, p := range config.GetAIProviders() {
			if p.Name == req.ProviderName {
				cp := p
				provider = &cp
				break
			}
		}
	}
	if provider == nil {
		provider = config.GetDefaultAIProvider()
	}
	if provider == nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "未配置AI服务提供商"})
		return
	}

	// 构建日志上下文
	logContext, err := service.BuildLogContext(req.StartDate, req.EndDate, req.Categories)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	systemPrompt := fmt.Sprintf(`你是一个生活日志分析助手。用户会提供一段时间内的活动日志数据，请根据用户的问题对这些数据进行分析和总结。
请用中文回答，使用 Markdown 格式输出。

%s`, logContext)

	// 如果用户提供了自定义提示词，追加到系统提示中
	if req.SystemPrompt != "" {
		systemPrompt = fmt.Sprintf("%s\n\n用户自定义指令：\n%s", systemPrompt, req.SystemPrompt)
	}

	// 构建消息列表
	messages := make([]model.AIChatMessage, len(req.History))
	copy(messages, req.History)
	messages = append(messages, model.AIChatMessage{Role: "user", Content: req.Message})

	// SSE 流式响应
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	writer := c.Writer
	flusher, _ := writer.(http.Flusher)

	if err := service.StreamChat(*provider, systemPrompt, messages, writer, flusher); err != nil {
		errData := fmt.Sprintf(`data: {"error": "%s"}`, err.Error())
		fmt.Fprintf(writer, "%s\n\n", errData)
		if flusher != nil {
			flusher.Flush()
		}
	}
}
