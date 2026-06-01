package service

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/util"
)

const (
	defaultSuggestionLimit      = 6
	maxSuggestionLimit          = 20
	defaultSuggestionWindowDays = 90
	maxSuggestionWindowDays     = 365
)

type suggestionStat struct {
	eventType    string
	count        int
	score        float64
	lastUsedAt   string
	nearTimeHits int
	weekdayHits  int
	recentHits   int
}

// InferLogSuggestions returns likely completed activities for a date/time.
func InferLogSuggestions(req model.LogSuggestionRequest) (*model.LogSuggestionResponse, error) {
	targetDate, targetTime, targetAt, err := normalizeSuggestionTime(req.LogDate, req.LogTime)
	if err != nil {
		return nil, err
	}

	limit := req.Limit
	if limit <= 0 {
		limit = defaultSuggestionLimit
	}
	if limit > maxSuggestionLimit {
		limit = maxSuggestionLimit
	}

	windowDays := req.WindowDays
	if windowDays <= 0 {
		windowDays = defaultSuggestionWindowDays
	}
	if windowDays > maxSuggestionWindowDays {
		windowDays = maxSuggestionWindowDays
	}

	startDate := targetAt.AddDate(0, 0, -windowDays).Format("2006-01-02")
	entries, err := repository.GetSuggestionEntries(startDate, targetDate, targetTime, 1000)
	if err != nil {
		return nil, fmt.Errorf("查询历史日志失败: %w", err)
	}

	stats := scoreSuggestionEntries(entries, targetAt)
	candidates := buildSuggestionCandidates(stats, limit)
	return &model.LogSuggestionResponse{
		LogDate:    targetDate,
		LogTime:    targetTime,
		Candidates: candidates,
	}, nil
}

func normalizeSuggestionTime(dateValue, timeValue string) (string, string, time.Time, error) {
	now := time.Now()
	if strings.TrimSpace(dateValue) == "" {
		dateValue = now.Format("2006-01-02")
	}
	if strings.TrimSpace(timeValue) == "" {
		timeValue = now.Format("15:04")
	}

	parsedTime, err := util.ParseTime(timeValue)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("时间格式错误: %w", err)
	}

	targetAt, err := time.ParseInLocation("2006-01-02 15:04:05", dateValue+" "+parsedTime, time.Local)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("日期格式错误: %w", err)
	}
	return dateValue, parsedTime, targetAt, nil
}

func scoreSuggestionEntries(entries []model.LogEntry, targetAt time.Time) map[string]*suggestionStat {
	stats := make(map[string]*suggestionStat)
	targetMinutes := targetAt.Hour()*60 + targetAt.Minute()
	targetWeekday := targetAt.Weekday()
	recentCutoff := targetAt.AddDate(0, 0, -14)

	for _, entry := range entries {
		eventType := strings.TrimSpace(entry.EventType)
		if eventType == "" || IsMarkerEntry(entry) {
			continue
		}

		entryAt, err := parseEntryDateTime(entry)
		if err != nil {
			continue
		}
		entryMinutes := entryAt.Hour()*60 + entryAt.Minute()
		distance := cyclicMinuteDistance(targetMinutes, entryMinutes)

		stat := stats[eventType]
		if stat == nil {
			stat = &suggestionStat{eventType: eventType}
			stats[eventType] = stat
		}
		stat.count++
		stat.score += 6

		if distance <= 45 {
			stat.nearTimeHits++
			stat.score += 40 - float64(distance)/2
		} else if distance <= 90 {
			stat.score += 12
		}

		if entryAt.Weekday() == targetWeekday {
			stat.weekdayHits++
			stat.score += 14
		}

		if entryAt.After(recentCutoff) {
			stat.recentHits++
			stat.score += 10
		}

		usedAt := entry.LogDate + " " + entry.LogTime
		if usedAt > stat.lastUsedAt {
			stat.lastUsedAt = usedAt
		}
	}

	return stats
}

func buildSuggestionCandidates(stats map[string]*suggestionStat, limit int) []model.LogSuggestionCandidate {
	items := make([]*suggestionStat, 0, len(stats))
	for _, stat := range stats {
		items = append(items, stat)
	}

	sort.SliceStable(items, func(i, j int) bool {
		if math.Abs(items[i].score-items[j].score) > 0.0001 {
			return items[i].score > items[j].score
		}
		if items[i].lastUsedAt != items[j].lastUsedAt {
			return items[i].lastUsedAt > items[j].lastUsedAt
		}
		return items[i].eventType < items[j].eventType
	})

	if len(items) > limit {
		items = items[:limit]
	}

	candidates := make([]model.LogSuggestionCandidate, 0, len(items))
	for _, stat := range items {
		candidates = append(candidates, model.LogSuggestionCandidate{
			EventType:  stat.eventType,
			Category:   MatchCategory(stat.eventType),
			Score:      math.Round(stat.score*10) / 10,
			Reason:     formatSuggestionReason(stat),
			LastUsedAt: stat.lastUsedAt,
			Count:      stat.count,
		})
	}
	return candidates
}

func parseEntryDateTime(entry model.LogEntry) (time.Time, error) {
	logTime := entry.LogTime
	if len(logTime) == 5 {
		logTime += ":00"
	}
	return time.ParseInLocation("2006-01-02 15:04:05", entry.LogDate+" "+logTime, time.Local)
}

func cyclicMinuteDistance(a, b int) int {
	diff := int(math.Abs(float64(a - b)))
	if diff > 720 {
		return 1440 - diff
	}
	return diff
}

func formatSuggestionReason(stat *suggestionStat) string {
	parts := make([]string, 0, 3)
	if stat.nearTimeHits > 0 {
		parts = append(parts, fmt.Sprintf("相近时间出现 %d 次", stat.nearTimeHits))
	}
	if stat.weekdayHits > 0 {
		parts = append(parts, fmt.Sprintf("同星期出现 %d 次", stat.weekdayHits))
	}
	if stat.recentHits > 0 {
		parts = append(parts, fmt.Sprintf("近两周出现 %d 次", stat.recentHits))
	}
	if len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("历史记录出现 %d 次", stat.count))
	}
	return strings.Join(parts, "，")
}
