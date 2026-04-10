package scheduler

import (
	"fmt"
	"log/slog"
	"sort"
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
		TemplateDetail: buildFallbackDailyReport(stats),
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
		TemplateDetail: buildFallbackPeriodReport(reportLabel, stats),
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

type reportEventRollup struct {
	EventType    string
	Category     string
	Duration     int
	Display      string
	Count        int
	UnknownCount int
	CrossDay     int
}

func buildFallbackDailyReport(stats *model.DailyStatistics) string {
	var sb strings.Builder

	unknownCount := countUnknownItems(stats.Items)
	crossDayCount := countCrossDayItems(stats.Items)
	topCategories := joinTopCategories(stats.Summary, 3)

	sb.WriteString(fmt.Sprintf("# %s 日报\n\n", stats.Date))
	switch {
	case len(stats.Items) == 0:
		sb.WriteString("今天没有可用于生成摘要的记录。\n")
	case stats.TotalKnown == 0:
		sb.WriteString(fmt.Sprintf("今天共记录 %d 个事项，但暂时没有可可靠统计的时长数据。\n", len(stats.Items)))
	default:
		sb.WriteString(fmt.Sprintf(
			"今天共记录 %d 个事项，已知时长 **%s**，主要投入在 %s。\n",
			len(stats.Items),
			formatSeconds(stats.TotalKnown),
			topCategories,
		))
	}

	sb.WriteString("\n## 概览\n")
	sb.WriteString(fmt.Sprintf("- 记录事项：%d 条\n", len(stats.Items)))
	sb.WriteString(fmt.Sprintf("- 已知总时长：%s\n", formatSeconds(stats.TotalKnown)))
	sb.WriteString(fmt.Sprintf("- 分类数量：%d 类\n", len(stats.Summary)))
	sb.WriteString(fmt.Sprintf("- 记录模式：`%s`\n", stats.TimePointMode))
	if unknownCount > 0 {
		sb.WriteString(fmt.Sprintf("- 未知时长片段：%d 条\n", unknownCount))
	}
	if crossDayCount > 0 {
		sb.WriteString(fmt.Sprintf("- 跨日片段：%d 条\n", crossDayCount))
	}

	sb.WriteString("\n## 分类投入\n")
	if len(stats.Summary) == 0 {
		sb.WriteString("- 暂无可统计的分类时长。\n")
	} else {
		for i, item := range stats.Summary {
			sb.WriteString(fmt.Sprintf("%d. **%s**：%s（%.1f%%）\n", i+1, item.Category, item.Display, item.Percentage))
		}
	}

	sb.WriteString("\n## 重点活动\n")
	topItems := topKnownItems(stats.Items, 5)
	if len(topItems) == 0 {
		sb.WriteString("- 暂无可排序的重点活动。\n")
	} else {
		for _, item := range topItems {
			sb.WriteString("- " + renderDurationItem(item) + "\n")
		}
	}

	sb.WriteString("\n## 时间轴\n")
	if len(stats.Items) == 0 {
		sb.WriteString("- 今天还没有形成时间轴数据。\n")
	} else {
		for _, item := range stats.Items {
			sb.WriteString("- " + renderDurationItem(item) + "\n")
		}
	}

	if len(stats.CrossDayHints) > 0 {
		sb.WriteString("\n## 跨日提示\n")
		for _, hint := range stats.CrossDayHints {
			direction := "延续到次日"
			if hint.Direction == "prev" {
				direction = "承接自前一日"
			}
			sb.WriteString(fmt.Sprintf(
				"- `%s-%s` **%s** · %s · %s\n",
				hint.StartTime,
				hint.EndTime,
				hint.EventType,
				hint.Category,
				direction,
			))
		}
	}

	if needSampleNotice(len(stats.Items), unknownCount) {
		sb.WriteString("\n## 说明\n")
		if len(stats.Items) < 3 {
			sb.WriteString("- 当天记录较少，摘要更适合作为回顾索引而不是完整结论。\n")
		}
		if unknownCount > 0 {
			sb.WriteString("- 存在无法精确计算时长的片段，统计结果会偏保守。\n")
		}
	}

	return strings.TrimSpace(sb.String())
}

func buildFallbackPeriodReport(reportLabel string, stats *model.PeriodStatistics) string {
	var sb strings.Builder

	unknownCount := countUnknownItems(stats.Items)
	crossDayCount := countCrossDayItems(stats.Items)
	topCategories := joinTopCategories(stats.Summary, 3)

	sb.WriteString(fmt.Sprintf("# %s\n\n", reportLabel))
	switch {
	case len(stats.Items) == 0:
		sb.WriteString("这个周期内没有可用于生成摘要的记录。\n")
	case stats.TotalKnown == 0:
		sb.WriteString(fmt.Sprintf("这个周期共记录 %d 个片段，但暂时没有可可靠统计的时长数据。\n", len(stats.Items)))
	default:
		sb.WriteString(fmt.Sprintf(
			"本周期覆盖 **%d 天**，共记录 **%d 条**片段，已知时长 **%s**，主要投入在 %s。\n",
			stats.DayCount,
			len(stats.Items),
			formatSeconds(stats.TotalKnown),
			topCategories,
		))
	}

	sb.WriteString("\n## 概览\n")
	sb.WriteString(fmt.Sprintf("- 统计区间：`%s ~ %s`\n", stats.StartDate, stats.EndDate))
	sb.WriteString(fmt.Sprintf("- 覆盖天数：%d 天\n", stats.DayCount))
	sb.WriteString(fmt.Sprintf("- 记录片段：%d 条\n", len(stats.Items)))
	sb.WriteString(fmt.Sprintf("- 已知总时长：%s\n", formatSeconds(stats.TotalKnown)))
	if stats.DayCount > 0 && stats.TotalKnown > 0 {
		sb.WriteString(fmt.Sprintf("- 日均已知时长：%s\n", formatSeconds(stats.TotalKnown/stats.DayCount)))
	}
	if unknownCount > 0 {
		sb.WriteString(fmt.Sprintf("- 未知时长片段：%d 条\n", unknownCount))
	}
	if crossDayCount > 0 {
		sb.WriteString(fmt.Sprintf("- 跨日片段：%d 条\n", crossDayCount))
	}

	sb.WriteString("\n## 分类投入\n")
	if len(stats.Summary) == 0 {
		sb.WriteString("- 暂无可统计的分类时长。\n")
	} else {
		for i, item := range stats.Summary {
			sb.WriteString(fmt.Sprintf("%d. **%s**：%s（%.1f%%）\n", i+1, item.Category, item.Display, item.Percentage))
		}
	}

	sb.WriteString("\n## 高频活动\n")
	rollups := summarizeEvents(stats.Items)
	if len(rollups) == 0 {
		sb.WriteString("- 暂无可汇总的活动。\n")
	} else {
		for i, item := range rollups {
			if i >= minInt(len(rollups), 8) {
				break
			}
			detail := fmt.Sprintf("累计 %s / %d 次", item.Display, item.Count)
			if item.Duration == 0 && item.UnknownCount > 0 {
				detail = fmt.Sprintf("共 %d 次，其中 %d 次时长待定", item.Count, item.UnknownCount)
			} else if item.UnknownCount > 0 {
				detail += fmt.Sprintf("，另有 %d 次时长待定", item.UnknownCount)
			}
			if item.CrossDay > 0 {
				detail += fmt.Sprintf("，%d 次跨日", item.CrossDay)
			}
			sb.WriteString(fmt.Sprintf("- **%s** · %s · %s\n", item.EventType, item.Category, detail))
		}
	}

	sb.WriteString("\n## 重点片段\n")
	topItems := topKnownItems(stats.Items, 8)
	if len(topItems) == 0 {
		sb.WriteString("- 暂无可排序的重点片段。\n")
	} else {
		for _, item := range topItems {
			sb.WriteString("- " + renderDurationItem(item) + "\n")
		}
	}

	if needSampleNotice(len(stats.Items), unknownCount) {
		sb.WriteString("\n## 说明\n")
		if stats.DayCount < 3 || len(stats.Items) < 5 {
			sb.WriteString("- 样本量偏少，摘要更适合作为阶段性回看。\n")
		}
		if unknownCount > 0 {
			sb.WriteString("- 部分片段缺少完整边界，累计时长会略偏保守。\n")
		}
	}

	return strings.TrimSpace(sb.String())
}

func joinTopCategories(summary []model.CategorySummary, limit int) string {
	if len(summary) == 0 {
		return "暂无明显分类偏好"
	}

	names := make([]string, 0, minInt(len(summary), limit))
	for i, item := range summary {
		if i >= limit {
			break
		}
		names = append(names, fmt.Sprintf("**%s**", item.Category))
	}

	return strings.Join(names, "、")
}

func summarizeEvents(items []model.DurationItem) []reportEventRollup {
	rollupMap := make(map[string]*reportEventRollup)
	for _, item := range items {
		key := item.EventType + "|" + item.Category
		current, ok := rollupMap[key]
		if !ok {
			current = &reportEventRollup{
				EventType: item.EventType,
				Category:  item.Category,
			}
			rollupMap[key] = current
		}

		current.Count++
		if item.CrossDay {
			current.CrossDay++
		}
		if item.Unknown {
			current.UnknownCount++
			continue
		}

		current.Duration += item.Duration
		current.Display = formatSeconds(current.Duration)
	}

	rollups := make([]reportEventRollup, 0, len(rollupMap))
	for _, item := range rollupMap {
		rollups = append(rollups, *item)
	}

	sort.Slice(rollups, func(i, j int) bool {
		if rollups[i].Duration != rollups[j].Duration {
			return rollups[i].Duration > rollups[j].Duration
		}
		if rollups[i].Count != rollups[j].Count {
			return rollups[i].Count > rollups[j].Count
		}
		return rollups[i].EventType < rollups[j].EventType
	})

	return rollups
}

func topKnownItems(items []model.DurationItem, limit int) []model.DurationItem {
	known := make([]model.DurationItem, 0, len(items))
	for _, item := range items {
		if item.Unknown {
			continue
		}
		known = append(known, item)
	}

	sort.Slice(known, func(i, j int) bool {
		if known[i].Duration != known[j].Duration {
			return known[i].Duration > known[j].Duration
		}
		return renderTimeRange(known[i]) < renderTimeRange(known[j])
	})

	if len(known) > limit {
		known = known[:limit]
	}
	return known
}

func renderDurationItem(item model.DurationItem) string {
	parts := []string{
		fmt.Sprintf("`%s`", item.EventType),
		item.Category,
	}

	if item.Unknown {
		parts = append(parts, "时长待定")
	} else {
		parts = append(parts, item.Display)
	}
	if item.CrossDay {
		parts = append(parts, "跨日")
	}

	return fmt.Sprintf("%s · %s", renderTimeRange(item), strings.Join(parts, " · "))
}

func renderTimeRange(item model.DurationItem) string {
	switch {
	case item.StartTime != "" && item.EndTime != "":
		return fmt.Sprintf("`%s-%s`", item.StartTime, item.EndTime)
	case item.StartTime != "":
		return fmt.Sprintf("`%s-?`", item.StartTime)
	case item.EndTime != "":
		return fmt.Sprintf("`?-%s`", item.EndTime)
	default:
		return "`时间待定`"
	}
}

func countUnknownItems(items []model.DurationItem) int {
	count := 0
	for _, item := range items {
		if item.Unknown {
			count++
		}
	}
	return count
}

func countCrossDayItems(items []model.DurationItem) int {
	count := 0
	for _, item := range items {
		if item.CrossDay {
			count++
		}
	}
	return count
}

func needSampleNotice(itemCount, unknownCount int) bool {
	return itemCount < 5 || unknownCount > 0
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
