package events

// EventVariable 事件变量定义
type EventVariable struct {
	Key         string `json:"key"`
	Description string `json:"description"`
}

// EventDefinition 事件定义（包含可用变量）
type EventDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Variables   []EventVariable `json:"variables"`
}

// Registry 所有事件定义
var Registry = []EventDefinition{
	{
		Name:        "log.created",
		Description: "日志创建",
		Variables: []EventVariable{
			{Key: "log_id", Description: "日志ID"},
			{Key: "log_date", Description: "日志日期"},
			{Key: "log_time", Description: "日志时间"},
			{Key: "event_type", Description: "事项类型"},
			{Key: "detail", Description: "详情"},
			{Key: "category", Description: "所属分类"},
		},
	},
	{
		Name:        "log.updated",
		Description: "日志更新",
		Variables: []EventVariable{
			{Key: "log_id", Description: "日志ID"},
			{Key: "log_date", Description: "日志日期"},
			{Key: "log_time", Description: "日志时间"},
			{Key: "event_type", Description: "事项类型"},
			{Key: "detail", Description: "详情"},
			{Key: "category", Description: "所属分类"},
		},
	},
	{
		Name:        "log.deleted",
		Description: "日志删除",
		Variables: []EventVariable{
			{Key: "log_id", Description: "日志ID"},
		},
	},
	{
		Name:        "auth.login.succeeded",
		Description: "登录成功",
		Variables: []EventVariable{
			{Key: "ip", Description: "客户端IP"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "auth.password.changed",
		Description: "密码修改",
		Variables: []EventVariable{
			{Key: "ip", Description: "客户端IP"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "categories.updated",
		Description: "分类规则更新",
		Variables: []EventVariable{
			{Key: "count", Description: "分类数量"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "settings.updated",
		Description: "系统设置更新",
		Variables: []EventVariable{
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "data.exported",
		Description: "数据导出",
		Variables: []EventVariable{
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "data.imported",
		Description: "数据导入",
		Variables: []EventVariable{
			{Key: "logs_imported", Description: "导入日志数"},
			{Key: "logs_skipped", Description: "跳过日志数"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "ai.provider.created",
		Description: "AI 服务商创建",
		Variables: []EventVariable{
			{Key: "provider_name", Description: "服务商名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "ai.provider.updated",
		Description: "AI 服务商更新",
		Variables: []EventVariable{
			{Key: "provider_name", Description: "服务商名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "ai.provider.deleted",
		Description: "AI 服务商删除",
		Variables: []EventVariable{
			{Key: "provider_name", Description: "服务商名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
}
