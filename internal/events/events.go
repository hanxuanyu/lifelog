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
	{
		Name:        "task.daily_report",
		Description: "日报生成完成",
		Variables: []EventVariable{
			{Key: "report_date", Description: "报告日期"},
			{Key: "summary", Description: "分类汇总"},
			{Key: "total_known", Description: "已知总时长"},
			{Key: "detail", Description: "详细内容"},
			{Key: "report_source", Description: "报告来源（ai/template）"},
			{Key: "report_provider", Description: "AI 服务商名称"},
			{Key: "report_model", Description: "AI 模型名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.weekly_report",
		Description: "周报生成完成",
		Variables: []EventVariable{
			{Key: "start_date", Description: "开始日期"},
			{Key: "end_date", Description: "结束日期"},
			{Key: "summary", Description: "分类汇总"},
			{Key: "total_known", Description: "已知总时长"},
			{Key: "day_count", Description: "天数"},
			{Key: "detail", Description: "详细内容"},
			{Key: "report_source", Description: "报告来源（ai/template）"},
			{Key: "report_provider", Description: "AI 服务商名称"},
			{Key: "report_model", Description: "AI 模型名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.monthly_report",
		Description: "月报生成完成",
		Variables: []EventVariable{
			{Key: "start_date", Description: "开始日期"},
			{Key: "end_date", Description: "结束日期"},
			{Key: "summary", Description: "分类汇总"},
			{Key: "total_known", Description: "已知总时长"},
			{Key: "day_count", Description: "天数"},
			{Key: "detail", Description: "详细内容"},
			{Key: "report_source", Description: "报告来源（ai/template）"},
			{Key: "report_provider", Description: "AI 服务商名称"},
			{Key: "report_model", Description: "AI 模型名称"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.no_log_reminder",
		Description: "长时间未记录提醒",
		Variables: []EventVariable{
			{Key: "last_log_time", Description: "最后记录时间"},
			{Key: "idle_hours", Description: "空闲小时数"},
			{Key: "message", Description: "提醒消息"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.uncategorized_reminder",
		Description: "未分类事项提醒",
		Variables: []EventVariable{
			{Key: "report_date", Description: "报告日期"},
			{Key: "uncategorized_count", Description: "未分类记录数"},
			{Key: "message", Description: "提醒消息"},
			{Key: "detail", Description: "详细内容"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.activity_end_reminder",
		Description: "活动结束提醒",
		Variables: []EventVariable{
			{Key: "log_id", Description: "日志ID"},
			{Key: "event_type", Description: "活动名称"},
			{Key: "detail", Description: "活动详情"},
			{Key: "category", Description: "所属分类"},
			{Key: "log_date", Description: "日志日期"},
			{Key: "start_time", Description: "活动开始时间"},
			{Key: "end_time", Description: "活动结束时间"},
			{Key: "duration", Description: "持续时长"},
			{Key: "message", Description: "提醒消息"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.next_activity_reminder",
		Description: "下一活动提醒",
		Variables: []EventVariable{
			{Key: "ended_event_type", Description: "刚结束的活动名称"},
			{Key: "ended_category", Description: "刚结束的活动分类"},
			{Key: "ended_time", Description: "结束时间"},
			{Key: "next_log_id", Description: "下一活动日志ID"},
			{Key: "next_event_type", Description: "下一活动名称"},
			{Key: "next_category", Description: "下一活动分类"},
			{Key: "next_detail", Description: "下一活动详情"},
			{Key: "next_start_time", Description: "下一活动开始时间"},
			{Key: "next_end_time", Description: "下一活动结束时间"},
			{Key: "message", Description: "提醒消息"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
	{
		Name:        "task.smart_reminder",
		Description: "智能提醒触发",
		Variables: []EventVariable{
			{Key: "checkpoint_name", Description: "检查点名称"},
			{Key: "checkpoint_description", Description: "检查点描述"},
			{Key: "expected_time", Description: "预期时间"},
			{Key: "category", Description: "所属分类"},
			{Key: "message", Description: "提醒消息"},
			{Key: "timestamp", Description: "时间戳"},
		},
	},
}
