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

	// 始终查询跨天衔接数据（因为日志可能包含混合模式）
	var prevEntry *model.LogEntry
	var nextEntry *model.LogEntry

	if len(entries) > 0 {
		prev, err := repository.GetLastEntryBefore(date)
		if err == nil {
			prevEntry = prev
		}
		next, err := repository.GetFirstEntryAfter(date)
		if err == nil {
			nextEntry = next
		}
	}

	items := calculateDurations(entries, date, prevEntry, nextEntry)
	summary, totalKnown := buildSummary(items)

	// 生成跨日提示
	var hints []model.CrossDayHint

	if len(entries) > 0 {
		// 检查前一天最后一条是否跨日到本天（start 模式跨日）
		if prevEntry != nil && prevEntry.LogDate != date && getEntryMode(prevEntry) == "start" {
			hints = append(hints, model.CrossDayHint{
				EventType: prevEntry.EventType,
				Category:  MatchCategory(prevEntry.EventType),
				StartTime: "00:00",
				EndTime:   entries[0].LogTime[:5],
				Direction: "prev",
			})
		}

		// 检查后一天第一条是否从本天跨日过去（end 模式跨日）
		if nextEntry != nil && nextEntry.LogDate != date && getEntryMode(nextEntry) == "end" {
			lastTime := entries[len(entries)-1].LogTime[:5]
			hints = append(hints, model.CrossDayHint{
				EventType: nextEntry.EventType,
				Category:  MatchCategory(nextEntry.EventType),
				StartTime: lastTime,
				EndTime:   "23:59",
				Direction: "next",
			})
		}
	}

	return &model.DailyStatistics{
		Date:          date,
		Items:         items,
		Summary:       summary,
		TotalKnown:    totalKnown,
		TimePointMode: config.GetTimePointMode(),
		CrossDayHints: hints,
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

	// 按天分组计算，支持跨天衔接
	dayGroups := groupByDate(entries)

	// 排序日期
	var dates []string
	for d := range dayGroups {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	var allItems []model.DurationItem

	for i, date := range dates {
		dayEntries := dayGroups[date]
		prevEntry, nextEntry := resolveAdjacentEntries(dayGroups, dates, i)

		items := calculateDurations(dayEntries, date, prevEntry, nextEntry)
		allItems = append(allItems, items...)
	}

	summary, totalKnown := buildSummary(allItems)

	return &model.PeriodStatistics{
		StartDate:  startDate,
		EndDate:    endDate,
		Summary:    summary,
		TotalKnown: totalKnown,
		DayCount:   len(dates),
		Items:      allItems,
	}, nil
}

// GetTrendStatistics 获取日期范围内每天的分类汇总（趋势分析）
func GetTrendStatistics(startDate, endDate string) (*model.TrendStatistics, error) {
	entries, err := repository.GetEntriesByDateRange(startDate, endDate)
	if err != nil {
		return nil, err
	}

	dayGroups := groupByDate(entries)

	var dates []string
	for d := range dayGroups {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	days := make([]model.DayBreakdown, 0, len(dates))

	for i, date := range dates {
		dayEntries := dayGroups[date]
		prevEntry, nextEntry := resolveAdjacentEntries(dayGroups, dates, i)

		items := calculateDurations(dayEntries, date, prevEntry, nextEntry)
		summary, totalKnown := buildSummary(items)

		days = append(days, model.DayBreakdown{
			Date:       date,
			Summary:    summary,
			TotalKnown: totalKnown,
		})
	}

	return &model.TrendStatistics{
		StartDate: startDate,
		EndDate:   endDate,
		Days:      days,
	}, nil
}

// resolveAdjacentEntries 获取某天的前后衔接日志
func resolveAdjacentEntries(dayGroups map[string][]model.LogEntry, dates []string, i int) (*model.LogEntry, *model.LogEntry) {
	date := dates[i]
	var prevEntry, nextEntry *model.LogEntry

	if i > 0 {
		prevDayEntries := dayGroups[dates[i-1]]
		if len(prevDayEntries) > 0 {
			last := prevDayEntries[len(prevDayEntries)-1]
			prevEntry = &last
		}
	} else {
		prev, err := repository.GetLastEntryBefore(date)
		if err == nil {
			prevEntry = prev
		}
	}

	if i < len(dates)-1 {
		nextDayEntries := dayGroups[dates[i+1]]
		if len(nextDayEntries) > 0 {
			first := nextDayEntries[0]
			nextEntry = &first
		}
	} else {
		next, err := repository.GetFirstEntryAfter(date)
		if err == nil {
			nextEntry = next
		}
	}

	return prevEntry, nextEntry
}

// getEntryMode 获取单条日志记录的时间点模式
// 如果日志本身已记录模式则使用之，否则回退到全局配置
func getEntryMode(e *model.LogEntry) string {
	if e.TimePointMode == "start" || e.TimePointMode == "end" {
		return e.TimePointMode
	}
	return config.GetTimePointMode()
}

// calculateDurations 根据每条日志自身的 time_point_mode 计算持续时间
// 在相邻两条模式不同的边界处标记 Unknown
// prevEntry: 前一天最后一条记录（用于补全第一条的起点）
// nextEntry: 后一天第一条记录（用于补全最后一条的终点）
func calculateDurations(entries []model.LogEntry, currentDate string, prevEntry, nextEntry *model.LogEntry) []model.DurationItem {
	if len(entries) == 0 {
		return nil
	}

	items := make([]model.DurationItem, len(entries))

	for i, e := range entries {
		mode := getEntryMode(&e)
		items[i] = model.DurationItem{
			EventType: e.EventType,
			Category:  MatchCategory(e.EventType),
		}

		logTime := e.LogTime[:5] // "HH:mm"

		switch mode {
		case "end":
			// End 模式: 当前记录时间是结束时间
			items[i].EndTime = logTime
			if i == 0 {
				// 第一条: 尝试使用前一天最后一条来补全起点
				if prevEntry != nil {
					prevMode := getEntryMode(prevEntry)
					if prevMode == "end" {
						// 模式一致，正常衔接
						prevTime := prevEntry.LogTime[:5]
						items[i].StartTime = prevTime
						items[i].CrossDay = true
						dur := crossDayDiffSeconds(prevEntry.LogDate, prevTime, currentDate, logTime)
						items[i].Duration = dur
						items[i].Display = formatDuration(dur)
					} else {
						// 前一天末条是 start 模式，当前是 end 模式 → 模式边界
						items[i].Unknown = true
						items[i].Display = "模式边界"
						items[i].StartTime = ""
					}
				} else {
					items[i].Unknown = true
					items[i].Display = "未知起点"
					items[i].StartTime = ""
				}
			} else {
				prevMode := getEntryMode(&entries[i-1])
				if prevMode == "end" {
					// 同一天内，模式一致
					prevTime := entries[i-1].LogTime[:5]
					items[i].StartTime = prevTime
					dur := timeDiffSeconds(entries[i-1].LogTime, e.LogTime)
					items[i].Duration = dur
					items[i].Display = formatDuration(dur)
				} else {
					// 模式边界: 前一条是 start，当前是 end
					items[i].Unknown = true
					items[i].Display = "模式边界"
					items[i].StartTime = ""
				}
			}
		case "start":
			// Start 模式: 当前记录时间是开始时间
			items[i].StartTime = logTime
			if i == len(entries)-1 {
				// 最后一条: 尝试使用后一天第一条来补全终点
				if nextEntry != nil {
					nextMode := getEntryMode(nextEntry)
					if nextMode == "start" {
						// 模式一致，正常衔接
						nextTime := nextEntry.LogTime[:5]
						items[i].EndTime = nextTime
						items[i].CrossDay = true
						dur := crossDayDiffSeconds(currentDate, logTime, nextEntry.LogDate, nextTime)
						items[i].Duration = dur
						items[i].Display = formatDuration(dur)
					} else {
						// 后一天首条是 end 模式 → 模式边界
						items[i].Unknown = true
						items[i].Display = "模式边界"
						items[i].EndTime = ""
					}
				} else {
					items[i].Unknown = true
					items[i].Display = "未知终点"
					items[i].EndTime = ""
				}
			} else {
				nextMode := getEntryMode(&entries[i+1])
				if nextMode == "start" {
					// 同一天内，模式一致
					nextTime := entries[i+1].LogTime[:5]
					items[i].EndTime = nextTime
					dur := timeDiffSeconds(e.LogTime, entries[i+1].LogTime)
					items[i].Duration = dur
					items[i].Display = formatDuration(dur)
				} else {
					// 模式边界: 下一条是 end，当前是 start
					items[i].Unknown = true
					items[i].Display = "模式边界"
					items[i].EndTime = ""
				}
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

// crossDayDiffSeconds 计算跨天的时间差（秒），支持不同日期
func crossDayDiffSeconds(fromDate, fromTime, toDate, toTime string) int {
	t1, err1 := time.Parse("2006-01-02 15:04", fromDate+" "+fromTime)
	t2, err2 := time.Parse("2006-01-02 15:04", toDate+" "+toTime)
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
