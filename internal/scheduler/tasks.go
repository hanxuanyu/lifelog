package scheduler

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
)

const (
	noLogReminderThresholdParam = "threshold_hours"
	noLogReminderThresholdHours = 4.0
)

type DailyReportTask struct{}

func (t *DailyReportTask) Name() string        { return "daily_report" }
func (t *DailyReportTask) Description() string { return "每日日报生成" }
func (t *DailyReportTask) DefaultCron() string { return "0 0 22 * * *" }
func (t *DailyReportTask) EventName() string   { return "task.daily_report" }

func (t *DailyReportTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	return buildReportPromptParamDefinitions(cfg)
}

func (t *DailyReportTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	date := time.Now().Format("2006-01-02")
	stats, err := service.GetDailyStatistics(date)
	if err != nil {
		return nil, fmt.Errorf("获取日报数据失败: %w", err)
	}

	return buildDailyReportEventData(date, stats, cfg), nil
}

type WeeklyReportTask struct{}

func (t *WeeklyReportTask) Name() string        { return "weekly_report" }
func (t *WeeklyReportTask) Description() string { return "每周周报生成" }
func (t *WeeklyReportTask) DefaultCron() string { return "0 0 10 * * 1" }
func (t *WeeklyReportTask) EventName() string   { return "task.weekly_report" }

func (t *WeeklyReportTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	return buildReportPromptParamDefinitions(cfg)
}

func (t *WeeklyReportTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	ref := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	stats, err := service.GetWeeklyStatistics(ref)
	if err != nil {
		return nil, fmt.Errorf("获取周报数据失败: %w", err)
	}

	return buildPeriodReportEventData("weekly_report", "周报", stats, cfg), nil
}

type MonthlyReportTask struct{}

func (t *MonthlyReportTask) Name() string        { return "monthly_report" }
func (t *MonthlyReportTask) Description() string { return "每月月报生成" }
func (t *MonthlyReportTask) DefaultCron() string { return "0 0 10 1 * *" }
func (t *MonthlyReportTask) EventName() string   { return "task.monthly_report" }

func (t *MonthlyReportTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	return buildReportPromptParamDefinitions(cfg)
}

func (t *MonthlyReportTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	ref := time.Now().AddDate(0, 0, -1)
	stats, err := service.GetMonthlyStatistics(ref.Year(), int(ref.Month()))
	if err != nil {
		return nil, fmt.Errorf("获取月报数据失败: %w", err)
	}

	return buildPeriodReportEventData("monthly_report", "月报", stats, cfg), nil
}

// NoLogReminderTask tracks reminder debounce state.
type NoLogReminderTask struct {
	mu                sync.Mutex
	lastReminderAt    time.Time
	lastReminderLogID uint
}

func (t *NoLogReminderTask) Name() string        { return "no_log_reminder" }
func (t *NoLogReminderTask) Description() string { return "长时间未记录日志提醒" }
func (t *NoLogReminderTask) DefaultCron() string { return "0 0 */2 * * *" }
func (t *NoLogReminderTask) EventName() string   { return "task.no_log_reminder" }

func (t *NoLogReminderTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	threshold := formatPositiveFloat(parsePositiveFloatParam(cfg, noLogReminderThresholdParam, noLogReminderThresholdHours))
	return []model.ScheduledTaskParamDefinition{
		{
			Key:         noLogReminderThresholdParam,
			Label:       "提醒阈值（小时）",
			Description: "距离最新一条日志超过该时长后才触发提醒，支持小数，例如 1.5 表示 1 小时 30 分钟。",
			Type:        "text",
			Placeholder: formatPositiveFloat(noLogReminderThresholdHours),
			Value:       threshold,
		},
	}
}

func (t *NoLogReminderTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	latest, err := repository.GetLatestEntry()
	if err != nil {
		return nil, nil
	}

	lastAt, err := parseEntryTime(latest)
	if err != nil {
		return nil, fmt.Errorf("解析最近日志时间失败: %w", err)
	}

	thresholdHours := parsePositiveFloatParam(cfg, noLogReminderThresholdParam, noLogReminderThresholdHours)
	idle := time.Since(lastAt)
	idleHours := idle.Hours()
	if idleHours < thresholdHours {
		return nil, nil
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	if latest.ID == t.lastReminderLogID && time.Since(t.lastReminderAt) < 2*time.Hour {
		return nil, nil
	}
	t.lastReminderAt = time.Now()
	t.lastReminderLogID = latest.ID

	msg := fmt.Sprintf(
		"您已 %.1f 小时未记录日志，最后一条：%s %s - %s",
		idleHours,
		latest.LogDate,
		latest.LogTime,
		latest.EventType,
	)

	return map[string]string{
		"last_log_time": latest.LogDate + " " + latest.LogTime,
		"idle_hours":    fmt.Sprintf("%.1f", idleHours),
		"message":       msg,
		"timestamp":     time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}

type UncategorizedReminderTask struct{}

func (t *UncategorizedReminderTask) Name() string        { return "uncategorized_reminder" }
func (t *UncategorizedReminderTask) Description() string { return "未分类事项提醒" }
func (t *UncategorizedReminderTask) DefaultCron() string { return "0 30 21 * * *" }
func (t *UncategorizedReminderTask) EventName() string   { return "task.uncategorized_reminder" }

func (t *UncategorizedReminderTask) ParameterDefinitions(model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	return nil
}

func (t *UncategorizedReminderTask) Execute(model.ScheduledTaskConfig) (map[string]string, error) {
	date := time.Now().Format("2006-01-02")
	entries, err := repository.GetTimelineEntries(date)
	if err != nil {
		return nil, fmt.Errorf("获取当日日志失败: %w", err)
	}
	if len(entries) == 0 {
		return nil, nil
	}

	uncategorized := make([]model.LogEntry, 0)
	for _, entry := range entries {
		if service.MatchCategory(entry.EventType) == "未分类" {
			uncategorized = append(uncategorized, entry)
		}
	}
	if len(uncategorized) == 0 {
		return nil, nil
	}

	message := fmt.Sprintf("今天还有 %d 条未分类事项，建议补充分组规则或规范事项名称。", len(uncategorized))
	return map[string]string{
		"report_date":         date,
		"uncategorized_count": fmt.Sprintf("%d", len(uncategorized)),
		"message":             message,
		"detail":              formatUncategorizedDetail(date, uncategorized),
		"timestamp":           time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}

func parseEntryTime(e *model.LogEntry) (time.Time, error) {
	tStr := e.LogTime
	if len(tStr) == 5 {
		tStr += ":00"
	}
	return time.ParseInLocation("2006-01-02 15:04:05", e.LogDate+" "+tStr, time.Local)
}

func formatCategorySummary(summary []model.CategorySummary) string {
	if len(summary) == 0 {
		return "(无数据)"
	}

	parts := make([]string, 0, len(summary))
	for _, s := range summary {
		parts = append(parts, fmt.Sprintf("%s %s (%.1f%%)", s.Category, s.Display, s.Percentage))
	}
	return strings.Join(parts, ", ")
}

func formatDailyDetail(stats *model.DailyStatistics) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("日报 - %s\n", stats.Date))
	sb.WriteString(fmt.Sprintf("总时长：%s\n\n", formatSeconds(stats.TotalKnown)))

	if len(stats.Summary) > 0 {
		sb.WriteString("分类汇总：\n")
		for _, s := range stats.Summary {
			sb.WriteString(fmt.Sprintf("  - %s: %s (%.1f%%)\n", s.Category, s.Display, s.Percentage))
		}
	}

	if len(stats.Items) > 0 {
		sb.WriteString("\n时间轴：\n")
		for _, item := range stats.Items {
			if item.Unknown {
				sb.WriteString(fmt.Sprintf("  - %s %s (时长待定)\n", item.StartTime, item.EventType))
				continue
			}
			sb.WriteString(fmt.Sprintf("  - %s-%s %s (%s)\n", item.StartTime, item.EndTime, item.EventType, item.Display))
		}
	}

	return sb.String()
}

func formatPeriodDetail(reportLabel string, stats *model.PeriodStatistics) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s - %s 至 %s\n", reportLabel, stats.StartDate, stats.EndDate))
	sb.WriteString(fmt.Sprintf("覆盖天数：%d 天\n", stats.DayCount))
	sb.WriteString(fmt.Sprintf("总时长：%s\n\n", formatSeconds(stats.TotalKnown)))

	if len(stats.Summary) > 0 {
		sb.WriteString("分类汇总：\n")
		for _, s := range stats.Summary {
			sb.WriteString(fmt.Sprintf("  - %s: %s (%.1f%%)\n", s.Category, s.Display, s.Percentage))
		}
	}

	return sb.String()
}

func formatUncategorizedDetail(date string, entries []model.LogEntry) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("未分类事项提醒 - %s\n", date))
	sb.WriteString(fmt.Sprintf("共有 %d 条记录尚未匹配分类：\n", len(entries)))
	for _, entry := range entries {
		line := fmt.Sprintf("  - %s %s", entry.LogTime[:5], entry.EventType)
		if entry.Detail != "" {
			line += fmt.Sprintf(" - %s", entry.Detail)
		}
		sb.WriteString(line + "\n")
	}
	sb.WriteString("\n建议：为高频事项补充分类规则，或统一事项名称，后续统计会更准确。")
	return sb.String()
}

func formatSeconds(seconds int) string {
	h := seconds / 3600
	m := (seconds % 3600) / 60
	if h > 0 && m > 0 {
		return fmt.Sprintf("%dh%dm", h, m)
	}
	if h > 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dm", m)
}

func parsePositiveFloatParam(cfg model.ScheduledTaskConfig, key string, fallback float64) float64 {
	raw := strings.TrimSpace(cfg.Params[key])
	if raw == "" {
		return fallback
	}

	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func formatPositiveFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

// RegisterBuiltinTasks registers all builtin tasks before the scheduler starts.
func RegisterBuiltinTasks() {
	RegisterBuiltinTask(&DailyReportTask{})
	RegisterBuiltinTask(&WeeklyReportTask{})
	RegisterBuiltinTask(&MonthlyReportTask{})
	RegisterBuiltinTask(&NoLogReminderTask{})
	RegisterBuiltinTask(&UncategorizedReminderTask{})
	RegisterBuiltinTask(&ActivityReminderTask{})
	RegisterBuiltinTask(&SmartReminderAnalyzeTask{})
	RegisterBuiltinTask(&SmartReminderCheckTask{})
}
