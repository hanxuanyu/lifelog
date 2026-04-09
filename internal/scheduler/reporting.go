package scheduler

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

type generatedReport struct {
	Detail   string
	Source   string
	Provider string
	Model    string
}

type reportRequest struct {
	TaskName       string
	ReportLabel    string
	StartDate      string
	EndDate        string
	TotalKnownText string
	SummaryText    string
	TemplateDetail string
}

const scheduledReportSystemPrompt = `你是一个生活日志报告助手，需要根据用户的结构化统计和原始日志生成可直接推送的中文 Markdown 报告。

要求：
1. 只基于提供的数据进行总结，不要虚构用户未记录的事情。
2. 第一段先给出一句总览。
3. 再用 2 到 4 个简短小节或要点，指出时间投入重点、节奏特征和可观察到的问题。
4. 语气客观、简洁、可读，适合消息通知或日报/周报推送。
5. 如果记录较少，要明确指出样本有限。`

func buildDailyReportEventData(date string, stats *model.DailyStatistics) map[string]string {
	summaryText := formatCategorySummary(stats.Summary)
	report := generateScheduledReport(reportRequest{
		TaskName:       "daily_report",
		ReportLabel:    fmt.Sprintf("%s 日报", date),
		StartDate:      date,
		EndDate:        date,
		TotalKnownText: formatSeconds(stats.TotalKnown),
		SummaryText:    summaryText,
		TemplateDetail: formatDailyDetail(stats),
	})

	return map[string]string{
		"report_date":     date,
		"summary":         summaryText,
		"total_known":     formatSeconds(stats.TotalKnown),
		"detail":          report.Detail,
		"report_source":   report.Source,
		"report_provider": report.Provider,
		"report_model":    report.Model,
		"timestamp":       time.Now().Format("2006-01-02 15:04:05"),
	}
}

func buildPeriodReportEventData(taskName, reportLabel string, stats *model.PeriodStatistics) map[string]string {
	summaryText := formatCategorySummary(stats.Summary)
	report := generateScheduledReport(reportRequest{
		TaskName:       taskName,
		ReportLabel:    reportLabel,
		StartDate:      stats.StartDate,
		EndDate:        stats.EndDate,
		TotalKnownText: formatSeconds(stats.TotalKnown),
		SummaryText:    summaryText,
		TemplateDetail: formatPeriodDetail(reportLabel, stats),
	})

	return map[string]string{
		"start_date":      stats.StartDate,
		"end_date":        stats.EndDate,
		"summary":         summaryText,
		"total_known":     formatSeconds(stats.TotalKnown),
		"day_count":       fmt.Sprintf("%d", stats.DayCount),
		"detail":          report.Detail,
		"report_source":   report.Source,
		"report_provider": report.Provider,
		"report_model":    report.Model,
		"timestamp":       time.Now().Format("2006-01-02 15:04:05"),
	}
}

func generateScheduledReport(req reportRequest) generatedReport {
	fallback := generatedReport{
		Detail: req.TemplateDetail,
		Source: "template",
	}

	provider := config.GetDefaultAIProvider()
	if provider == nil {
		return fallback
	}

	logContext, err := service.BuildLogContext(req.StartDate, req.EndDate, nil)
	if err != nil {
		slog.Warn("构建 AI 报告日志上下文失败，回退模板", "task", req.TaskName, "error", err)
		return fallback
	}

	userPrompt := strings.TrimSpace(fmt.Sprintf(`请生成「%s」。

统计信息：
- 时间范围：%s 至 %s
- 已知总时长：%s
- 分类汇总：%s

结构化草稿：
%s

原始日志：
%s`, req.ReportLabel, req.StartDate, req.EndDate, req.TotalKnownText, req.SummaryText, req.TemplateDetail, logContext))

	content, err := service.ChatCompletion(*provider, scheduledReportSystemPrompt, []model.AIChatMessage{
		{Role: "user", Content: userPrompt},
	})
	if err != nil {
		slog.Warn("AI 报告生成失败，回退模板", "task", req.TaskName, "provider", provider.Name, "model", provider.Model, "error", err)
		return fallback
	}

	content = strings.TrimSpace(content)
	if content == "" {
		return fallback
	}

	return generatedReport{
		Detail:   content,
		Source:   "ai",
		Provider: provider.Name,
		Model:    provider.Model,
	}
}
