package scheduler

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
)

const (
	activityEndReminderEvent  = "task.activity_end_reminder"
	nextActivityReminderEvent = "task.next_activity_reminder"
)

// ActivityReminderTask polls log entries and fires events when an activity's
// end time is reached or when a next activity is upcoming.
type ActivityReminderTask struct {
	mu          sync.Mutex
	notifiedMap map[uint]time.Time // logID -> last notified time
}

func (t *ActivityReminderTask) Name() string        { return "activity_monitor" }
func (t *ActivityReminderTask) Description() string { return "活动状态监控" }
func (t *ActivityReminderTask) DefaultCron() string { return "*/30 * * * * *" }
func (t *ActivityReminderTask) EventName() string   { return activityEndReminderEvent }

// EventNames implements MultiEventTask so runTask checks both event bindings.
func (t *ActivityReminderTask) EventNames() []string {
	return []string{activityEndReminderEvent, nextActivityReminderEvent}
}

func (t *ActivityReminderTask) ParameterDefinitions(model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	return nil
}

func (t *ActivityReminderTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	now := time.Now()
	today := now.Format("2006-01-02")

	entries, err := repository.GetTimelineEntries(today)
	if err != nil || len(entries) == 0 {
		return nil, nil
	}

	// Check bindings once to avoid unnecessary work.
	hasEndBinding := hasEnabledBindings(activityEndReminderEvent)
	hasNextBinding := hasEnabledBindings(nextActivityReminderEvent)
	if !hasEndBinding && !hasNextBinding {
		return nil, nil
	}

	t.mu.Lock()
	if t.notifiedMap == nil {
		t.notifiedMap = make(map[uint]time.Time)
	}
	t.mu.Unlock()

	// Clean up stale entries older than 1 hour.
	t.mu.Lock()
	for id, notifiedAt := range t.notifiedMap {
		if now.Sub(notifiedAt) > time.Hour {
			delete(t.notifiedMap, id)
		}
	}
	t.mu.Unlock()

	window := 60 * time.Second

	for i, entry := range entries {
		mode := entryMode(&entries[i])
		endTime, startTime, ok := resolveEndTime(entries, i, mode, today)
		if !ok {
			continue
		}

		// Check if end time just arrived: within the polling window and not in the future.
		if endTime.After(now) || now.Sub(endTime) > window {
			continue
		}

		// Check if already notified.
		t.mu.Lock()
		if _, notified := t.notifiedMap[entry.ID]; notified {
			t.mu.Unlock()
			continue
		}
		t.notifiedMap[entry.ID] = now
		t.mu.Unlock()

		category := service.MatchCategory(entry.EventType)
		dur := int(endTime.Sub(startTime).Seconds())
		if dur < 0 {
			dur = 0
		}

		// Try next activity reminder first; fall back to end reminder.
		nextPublished := false
		if hasNextBinding {
			nextPublished = publishNextActivityReminder(entries, i, mode, today, entry, category, endTime, now)
		}

		if !nextPublished && hasEndBinding {
			msg := fmt.Sprintf("活动 [%s] 已结束，持续 %s", entry.EventType, formatSeconds(dur))
			events.Publish(activityEndReminderEvent, map[string]string{
				"log_id":     fmt.Sprintf("%d", entry.ID),
				"event_type": entry.EventType,
				"detail":     entry.Detail,
				"category":   category,
				"log_date":   entry.LogDate,
				"start_time": startTime.Format("15:04"),
				"end_time":   endTime.Format("15:04"),
				"duration":   formatSeconds(dur),
				"message":    msg,
				"timestamp":  now.Format("2006-01-02 15:04:05"),
			})
			slog.Info("activity end reminder fired", "log_id", entry.ID, "event_type", entry.EventType)
		}
	}

	return nil, nil
}

// entryMode returns the time point mode for an entry, falling back to global config.
func entryMode(e *model.LogEntry) string {
	if e.TimePointMode == "start" || e.TimePointMode == "end" {
		return e.TimePointMode
	}
	return config.GetTimePointMode()
}

// resolveEndTime calculates the end time and start time for a given entry.
// Returns (endTime, startTime, ok).
func resolveEndTime(entries []model.LogEntry, idx int, mode, today string) (time.Time, time.Time, bool) {
	entry := entries[idx]
	entryTime, err := parseEntryTime(&entry)
	if err != nil {
		return time.Time{}, time.Time{}, false
	}

	switch mode {
	case "end":
		// End mode: LogTime is the end time. Start time comes from previous entry.
		endTime := entryTime
		var startTime time.Time
		if idx > 0 {
			prev := entries[idx-1]
			st, err := parseEntryTime(&prev)
			if err == nil {
				startTime = st
			}
		}
		return endTime, startTime, true

	case "start":
		// Start mode: LogTime is the start time. End time comes from next entry.
		startTime := entryTime
		if idx >= len(entries)-1 {
			return time.Time{}, time.Time{}, false // no next entry, activity ongoing
		}
		next := entries[idx+1]
		endTime, err := parseEntryTime(&next)
		if err != nil {
			return time.Time{}, time.Time{}, false
		}
		return endTime, startTime, true
	}

	return time.Time{}, time.Time{}, false
}

// publishNextActivityReminder checks for a subsequent activity after the ended one
// and publishes a next_activity_reminder event if found. Returns true if published.
func publishNextActivityReminder(entries []model.LogEntry, idx int, mode, today string, ended model.LogEntry, endedCategory string, endedTime, now time.Time) bool {
	var nextEntry *model.LogEntry

	switch mode {
	case "end":
		// In end mode, the next entry in timeline is the next activity.
		if idx+1 < len(entries) {
			nextEntry = &entries[idx+1]
		}
	case "start":
		// In start mode, the next entry is the one that provided the end time (idx+1).
		// The activity AFTER that is idx+2.
		if idx+2 < len(entries) {
			nextEntry = &entries[idx+2]
		}
	}

	if nextEntry == nil {
		return false
	}

	nextCategory := service.MatchCategory(nextEntry.EventType)
	nextMode := entryMode(nextEntry)
	nextStartTime := ""
	nextEndTime := ""

	switch nextMode {
	case "start":
		nextStartTime = nextEntry.LogTime[:5]
	case "end":
		// In end mode, start time is the previous entry's time (which is the ended entry's end time).
		nextStartTime = endedTime.Format("15:04")
		nextEndTime = nextEntry.LogTime[:5]
	}

	msg := fmt.Sprintf("[%s] 已结束，接下来是 [%s]", ended.EventType, nextEntry.EventType)
	events.Publish(nextActivityReminderEvent, map[string]string{
		"ended_event_type": ended.EventType,
		"ended_category":   endedCategory,
		"ended_time":       endedTime.Format("15:04"),
		"next_log_id":      fmt.Sprintf("%d", nextEntry.ID),
		"next_event_type":  nextEntry.EventType,
		"next_category":    nextCategory,
		"next_detail":      nextEntry.Detail,
		"next_start_time":  nextStartTime,
		"next_end_time":    nextEndTime,
		"message":          msg,
		"timestamp":        now.Format("2006-01-02 15:04:05"),
	})
	slog.Info("next activity reminder fired", "ended", ended.EventType, "next", nextEntry.EventType)
	return true
}
