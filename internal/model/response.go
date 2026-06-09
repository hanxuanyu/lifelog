package model

// Response 统一 API 响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// PageResult 分页结果
type PageResult struct {
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Size  int         `json:"size"`
	Items interface{} `json:"items"`
}

// LogEntryResponse is the public log DTO.
type LogEntryResponse struct {
	ID            uint   `json:"id"`
	LogDate       string `json:"log_date"`
	LogTime       string `json:"log_time"`
	EventType     string `json:"event_type"`
	Detail        string `json:"detail"`
	Category      string `json:"category"`
	TimePointMode string `json:"time_point_mode"`
	IsMarker      bool   `json:"is_marker"`
	TimeRange     string `json:"time_range,omitempty"`
}

// LogEntryRequest creates or updates a concrete log entry.
type LogEntryRequest struct {
	LogDate   string `json:"log_date" binding:"omitempty"`
	LogTime   string `json:"log_time" binding:"required"`
	EventType string `json:"event_type" binding:"required"`
	Detail    string `json:"detail"`
}

// LogMarkerRequest creates a temporary marker with only a time point.
type LogMarkerRequest struct {
	LogDate string `json:"log_date"`
	LogTime string `json:"log_time"`
	Source  string `json:"source"`
}

// LogSuggestionRequest asks the server to infer likely events for a time point.
type LogSuggestionRequest struct {
	LogDate    string `json:"log_date"`
	LogTime    string `json:"log_time"`
	Limit      int    `json:"limit"`
	WindowDays int    `json:"window_days"`
}

// LogSuggestionCandidate is one inferred event candidate.
type LogSuggestionCandidate struct {
	EventType  string  `json:"event_type"`
	Category   string  `json:"category"`
	Score      float64 `json:"score"`
	Reason     string  `json:"reason"`
	LastUsedAt string  `json:"last_used_at,omitempty"`
	Count      int     `json:"count"`
}

// LogSuggestionResponse contains inferred candidates for the requested time point.
type LogSuggestionResponse struct {
	LogDate    string                   `json:"log_date"`
	LogTime    string                   `json:"log_time"`
	Candidates []LogSuggestionCandidate `json:"candidates"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string `json:"token"`
}

// PasswordRequest 修改密码请求
type PasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password" binding:"required,min=4"`
}

// DurationItem 单条时长统计项
type DurationItem struct {
	EventType string `json:"event_type"`
	Category  string `json:"category"`
	Duration  int    `json:"duration"`            // 秒
	Display   string `json:"display"`             // 可读格式 "1h30m"
	Unknown   bool   `json:"unknown,omitempty"`   // 首条/末条未知时长
	CrossDay  bool   `json:"cross_day,omitempty"` // 跨天任务
	StartTime string `json:"start_time"`          // HH:mm
	EndTime   string `json:"end_time"`            // HH:mm
}

// CategorySummary 大类汇总
type CategorySummary struct {
	Category   string  `json:"category"`
	Duration   int     `json:"duration"` // 总秒数
	Display    string  `json:"display"`
	Percentage float64 `json:"percentage"` // 占比
}

// CrossDayHint 跨日提示（卡片不在本天，但时间轴需要显示淡色色段）
type CrossDayHint struct {
	EventType string `json:"event_type"`
	Category  string `json:"category"`
	StartTime string `json:"start_time"` // 在本天的起始时间
	EndTime   string `json:"end_time"`   // 在本天的结束时间
	Direction string `json:"direction"`  // "prev" = 卡片在前一天, "next" = 卡片在后一天
}

// DailyStatistics 日统计
type DailyStatistics struct {
	Date            string            `json:"date"`
	Items           []DurationItem    `json:"items"`
	Summary         []CategorySummary `json:"summary"`
	TotalKnown      int               `json:"total_known"` // 已知时长总秒数
	CrossDayHints   []CrossDayHint    `json:"cross_day_hints,omitempty"`
	PrevDayLastTime string            `json:"prev_day_last_time,omitempty"` // 前一天最后一条日志的时间
}

// PeriodStatistics 周/月统计
type PeriodStatistics struct {
	StartDate  string            `json:"start_date"`
	EndDate    string            `json:"end_date"`
	Summary    []CategorySummary `json:"summary"`
	TotalKnown int               `json:"total_known"`
	DayCount   int               `json:"day_count"`
	Items      []DurationItem    `json:"items,omitempty"`
}

// DayBreakdown 单日分类汇总（用于趋势分析）
type DayBreakdown struct {
	Date       string            `json:"date"`
	Summary    []CategorySummary `json:"summary"`
	TotalKnown int               `json:"total_known"`
}

// TrendStatistics 趋势统计
type TrendStatistics struct {
	StartDate string         `json:"start_date"`
	EndDate   string         `json:"end_date"`
	Days      []DayBreakdown `json:"days"`
}
