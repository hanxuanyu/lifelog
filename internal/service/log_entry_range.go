package service

import (
	"strings"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

func enrichTimeRanges(entries []model.LogEntry, responses []model.LogEntryResponse) ([]model.LogEntryResponse, error) {
	if len(entries) == 0 || len(responses) == 0 {
		return responses, nil
	}

	respByID := make(map[uint]*model.LogEntryResponse, len(responses))
	for i := range responses {
		respByID[responses[i].ID] = &responses[i]
	}

	for _, entry := range entries {
		resp, ok := respByID[entry.ID]
		if !ok {
			continue
		}

		prev, _, err := repository.GetAdjacentEntries(entry)
		if err != nil {
			return nil, err
		}

		resp.TimeRange = buildTimeRange(entry, prev)
	}

	return responses, nil
}

func buildTimeRange(entry model.LogEntry, prev *model.LogEntry) string {
	currentTime := trimClock(entry.LogTime)

	if prev != nil {
		return formatTimeEdge(prev.LogDate, trimClock(prev.LogTime), entry.LogDate) + " ~ " +
			formatTimeEdge(entry.LogDate, currentTime, entry.LogDate)
	}
	return "... ~ " + formatTimeEdge(entry.LogDate, currentTime, entry.LogDate)
}

func trimClock(value string) string {
	if len(value) >= 5 {
		return value[:5]
	}
	return value
}

func formatTimeEdge(date, timeText, baseDate string) string {
	if date == "" || strings.TrimSpace(timeText) == "" {
		return "..."
	}
	if date == baseDate {
		return timeText
	}
	if len(date) == len("2006-01-02") {
		return date[5:] + " " + timeText
	}
	return date + " " + timeText
}
