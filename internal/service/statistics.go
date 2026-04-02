package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

// GetDailyStatistics 获取某天的统计数据
func GetDailyStatistics(date string) (*model.DailyStatistics, error) {
	entries, err := repository.GetTimelineEntries(date)
	if err != nil {
		return nil, err
	}

	items := calculateDurations(entries)
	summary, totalKnown := buildSummary(items)

	return &model.DailyStatistics{
		Date:       date,
		Items:      items,
		Summary:    summary,
		TotalKnown: totalKnown,
	}, nil
}

// GetWeeklyStatistics 获取某天所在周的统计
func GetWeeklyStatistics(dateStr string) (*model.PeriodStatistics, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, fmt.Errorf("日期格式错误: %w", err)
	}

	// 计算周一和周日
	weekday := t.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -int(weekday-time.Monday))
	sunday := monday.AddDate(0, 0, 6)

	return getPeriodStatistics(monday.Format("2006-01-02"), sunday.Format("2006-01-02"))
}

// GetMonthlyStatistics 获取某月的统计
func GetMonthlyStatistics(year, month int) (*model.PeriodStatistics, error) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, -1)

	return getPeriodStatistics(start.Format("2006-01-02"), end.Format("2006-01-02"))
}

func getPeriodStatistics(startDate, endDate string) (*model.PeriodStatistics, error) {
	entries, err := repository.GetEntriesByDateRange(startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 按天分组计算
	dayGroups := groupByDate(entries)
	var allItems []model.DurationItem
	dayCount := 0

	for _, dayEntries := range dayGroups {
		items := calculateDurations(dayEntries)
		allItems = append(allItems, items...)
		dayCount++
	}

	summary, totalKnown := buildSummary(allItems)

	return &model.PeriodStatistics{
		StartDate:  startDate,
		EndDate:    endDate,
		Summary:    summary,
		TotalKnown: totalKnown,
		DayCount:   dayCount,
	}, nil
}

// calculateDurations 根据 time_point_mode 计算每条日志的持续时间
func calculateDurations(entries []model.LogEntry) []model.DurationItem {
	if len(entries) == 0 {
		return nil
	}

	mode := config.GetTimePointMode()
	items := make([]model.DurationItem, len(entries))

	for i, e := range entries {
		items[i] = model.DurationItem{
			EventType: e.EventType,
			Category:  MatchCategory(e.EventType),
		}

		switch mode {
		case "end":
			// End 模式: 当前记录时间 - 上一条记录时间 = 当前事项时长
			if i == 0 {
				items[i].Unknown = true
				items[i].Display = "未知起点"
			} else {
				dur := timeDiffSeconds(entries[i-1].LogTime, e.LogTime)
				items[i].Duration = dur
				items[i].Display = formatDuration(dur)
			}
		case "start":
			// Start 模式: 下一条记录时间 - 当前记录时间 = 当前事项时长
			if i == len(entries)-1 {
				items[i].Unknown = true
				items[i].Display = "未知终点"
			} else {
				dur := timeDiffSeconds(e.LogTime, entries[i+1].LogTime)
				items[i].Duration = dur
				items[i].Display = formatDuration(dur)
			}
		}
	}

	return items
}

func buildSummary(items []model.DurationItem) ([]model.CategorySummary, int) {
	catMap := make(map[string]int)
	totalKnown := 0

	for _, item := range items {
		if !item.Unknown {
			catMap[item.Category] += item.Duration
			totalKnown += item.Duration
		}
	}

	var summary []model.CategorySummary
	for cat, dur := range catMap {
		pct := 0.0
		if totalKnown > 0 {
			pct = float64(dur) / float64(totalKnown) * 100
		}
		summary = append(summary, model.CategorySummary{
			Category:   cat,
			Duration:   dur,
			Display:    formatDuration(dur),
			Percentage: pct,
		})
	}

	sort.Slice(summary, func(i, j int) bool {
		return summary[i].Duration > summary[j].Duration
	})

	return summary, totalKnown
}

func groupByDate(entries []model.LogEntry) map[string][]model.LogEntry {
	groups := make(map[string][]model.LogEntry)
	for _, e := range entries {
		groups[e.LogDate] = append(groups[e.LogDate], e)
	}
	return groups
}

func timeDiffSeconds(from, to string) int {
	t1, err1 := time.Parse("15:04:05", from)
	t2, err2 := time.Parse("15:04:05", to)
	if err1 != nil || err2 != nil {
		return 0
	}
	diff := int(t2.Sub(t1).Seconds())
	if diff < 0 {
		diff = 0
	}
	return diff
}

func formatDuration(seconds int) string {
	h := seconds / 3600
	m := (seconds % 3600) / 60
	if h > 0 && m > 0 {
		return fmt.Sprintf("%dh%dm", h, m)
	} else if h > 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dm", m)
}
