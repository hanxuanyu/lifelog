package model

// AIProvider AI 服务提供商配置
type AIProvider struct {
	Name     string `json:"name" yaml:"name" mapstructure:"name"`
	Endpoint string `json:"endpoint" yaml:"endpoint" mapstructure:"endpoint"`
	APIKey   string `json:"api_key" yaml:"api_key" mapstructure:"api_key"`
	Model    string `json:"model" yaml:"model" mapstructure:"model"`
	Default  bool   `json:"default" yaml:"default" mapstructure:"default"`
}

// AIChatRequest AI 对话请求
type AIChatRequest struct {
	ProviderName string          `json:"provider_name"`
	Model        string          `json:"model"`
	StartDate    string          `json:"start_date" binding:"required"`
	EndDate      string          `json:"end_date" binding:"required"`
	Message      string          `json:"message" binding:"required"`
	History      []AIChatMessage `json:"history"`
	SystemPrompt string          `json:"system_prompt"`
	Categories   []string        `json:"categories"` // 可选，筛选指定分类的日志
}

// AIChatMessage 对话消息
type AIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// FetchModelsRequest 获取模型列表请求
type FetchModelsRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	APIKey   string `json:"api_key"`
	Name     string `json:"name"`
}
