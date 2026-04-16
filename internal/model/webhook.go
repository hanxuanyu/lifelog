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

// ScheduledTaskConfig 定时任务配置
type ScheduledTaskConfig struct {
	Name    string            `json:"name" yaml:"name" mapstructure:"name"`
	Cron    string            `json:"cron" yaml:"cron" mapstructure:"cron"`
	Enabled bool              `json:"enabled" yaml:"enabled" mapstructure:"enabled"`
	Params  map[string]string `json:"params,omitempty" yaml:"params,omitempty" mapstructure:"params"`
}

// ParamOption 定义下拉选择等参数类型的选项
type ParamOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ScheduledTaskParamDefinition 定义定时任务可展示/编辑的额外参数
type ScheduledTaskParamDefinition struct {
	Key           string       `json:"key"`
	Label         string       `json:"label"`
	Description   string       `json:"description,omitempty"`
	Type          string       `json:"type"`
	Placeholder   string       `json:"placeholder,omitempty"`
	ReadOnly      bool         `json:"read_only,omitempty"`
	Value         string       `json:"value,omitempty"`
	Rows          int          `json:"rows,omitempty"`
	Options       []ParamOption `json:"options,omitempty"`
	Min           *float64     `json:"min,omitempty"`
	Max           *float64     `json:"max,omitempty"`
	Step          *float64     `json:"step,omitempty"`
	MapKeyLabel   string       `json:"map_key_label,omitempty"`
	MapValueLabel string       `json:"map_value_label,omitempty"`
}
