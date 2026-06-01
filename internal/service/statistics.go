package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

func GetDailyStatistics(date string) (*model.DailyStatistics, error) {
	entries, err := repository.GetTimelineEntries(date)
	if err != nil {
		return nil, err
	}

	var prevEntry *model.LogEntry
	prev, err := repository.GetLastEntryBefore(date)
	if err == nil {
		prevEntry = prev
	}

	items := calculateDurationsEndMode(entries, date, prevEntry)
	summary, totalKnown := buildSummary(items)

	var hints []model.CrossDayHint
	if len(entries) > 0 {
		nextEntry, err := repository.GetFirstEntryAfter(date)
		if err == nil && nextEntry != nil && nextEntry.LogDate != date {
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

	var prevDayLastTime string
	if prevEntry != nil && prevEntry.LogDate != date {
		prevDayLastTime = prevEntry.LogTime[:5]
	}

	return &model.DailyStatistics{
		Date:            date,
		Items:           items,
		Summary:         summary,
		TotalKnown:      totalKnown,
		CrossDayHints:   hints,
		PrevDayLastTime: prevDayLastTime,
	}, nil
}

func GetWeeklyStatistics(dateStr string) (*model.PeriodStatistics, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, fmt.Errorf("日期格式错误: %w", err)
	}

	weekday := t.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -int(weekday-time.Monday))
	sunday := monday.AddDate(0, 0, 6)

	return getPeriodStatistics(monday.Format("2006-01-02"), sunday.Format("2006-01-02"))
}

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

	dayGroups := groupByDate(entries)

	var dates []string
	for d := range dayGroups {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	var allItems []model.DurationItem
	for i, date := range dates {
		dayEntries := dayGroups[date]
		prevEntry := resolvePreviousEntry(dayGroups, dates, i)

		items := calculateDurationsEndMode(dayEntries, date, prevEntry)
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
		prevEntry := resolvePreviousEntry(dayGroups, dates, i)

		items := calculateDurationsEndMode(dayEntries, date, prevEntry)
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

func resolvePreviousEntry(dayGroups map[string][]model.LogEntry, dates []string, i int) *model.LogEntry {
	date := dates[i]

	if i > 0 {
		prevDayEntries := dayGroups[dates[i-1]]
		if len(prevDayEntries) > 0 {
			last := prevDayEntries[len(prevDayEntries)-1]
			return &last
		}
	} else {
		prev, err := repository.GetLastEntryBefore(date)
		if err == nil {
			return prev
		}
	}

	return nil
}

func calculateDurationsEndMode(entries []model.LogEntry, currentDate string, prevEntry *model.LogEntry) []model.DurationItem {
	if len(entries) == 0 {
		return nil
	}

	items := make([]model.DurationItem, len(entries))
	var prevBoundary *model.LogEntry
	if prevEntry != nil {
		prevBoundary = prevEntry
	}

	for i, e := range entries {
		logTime := e.LogTime[:5]
		items[i] = model.DurationItem{
			EventType: e.EventType,
			Category:  MatchCategory(e.EventType),
			EndTime:   logTime,
		}

		if prevBoundary == nil {
			items[i].Unknown = true
			items[i].StartTime = logTime
			items[i].Display = "未知起点"
			prevBoundary = &entries[i]
			continue
		}

		prevTime := prevBoundary.LogTime[:5]
		items[i].StartTime = prevTime

		var dur int
		if prevBoundary.LogDate != currentDate {
			items[i].CrossDay = true
			dur = crossDayDiffSeconds(prevBoundary.LogDate, prevTime, currentDate, logTime)
		} else {
			dur = timeDiffSeconds(prevBoundary.LogTime, e.LogTime)
		}

		items[i].Duration = dur
		items[i].Display = formatDuration(dur)
		prevBoundary = &entries[i]
	}

	return items
}

func buildSummary(items []model.DurationItem) ([]model.CategorySummary, int) {
	catMap := make(map[string]int)
	totalKnown := 0

	for _, item := range items {
		if !item.Unknown && item.EventType != "" && item.Category != "" {
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
	}
	if h > 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dm", m)
}
