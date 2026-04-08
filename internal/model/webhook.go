package model

// Webhook 定义一个 HTTP webhook 配置
type Webhook struct {
	Name           string            `json:"name" yaml:"name" mapstructure:"name"`
	URL            string            `json:"url" yaml:"url" mapstructure:"url"`
	Method         string            `json:"method" yaml:"method" mapstructure:"method"`
	Headers        map[string]string `json:"headers" yaml:"headers" mapstructure:"headers"`
	QueryParams    map[string]string `json:"query_params" yaml:"query_params" mapstructure:"query_params"`
	Body           string            `json:"body" yaml:"body" mapstructure:"body"`
	TimeoutSeconds int               `json:"timeout_seconds" yaml:"timeout_seconds" mapstructure:"timeout_seconds"`
}

// EventBinding 定义事件与 webhook 的绑定关系
type EventBinding struct {
	Event       string `json:"event" yaml:"event" mapstructure:"event"`
	WebhookName string `json:"webhook_name" yaml:"webhook_name" mapstructure:"webhook_name"`
	Enabled     bool   `json:"enabled" yaml:"enabled" mapstructure:"enabled"`
}
