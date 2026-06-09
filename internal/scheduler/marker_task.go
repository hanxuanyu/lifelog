package scheduler

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

const (
	staleMarkerThresholdParam = "threshold_hours"
	staleMarkerThresholdHours = 24.0
	staleMarkerLimitParam     = "limit"
	staleMarkerLimitDefault   = 20
)

// StaleMarkerReminderTask checks temporary markers that have not been completed.
type StaleMarkerReminderTask struct {
	mu              sync.Mutex
	lastReminderKey string
	lastReminderAt  time.Time
}

func (t *StaleMarkerReminderTask) Name() string        { return "stale_marker_reminder" }
func (t *StaleMarkerReminderTask) Description() string { return "临时打标待补充提醒" }
func (t *StaleMarkerReminderTask) DefaultCron() string { return "0 0 */4 * * *" }
func (t *StaleMarkerReminderTask) EventName() string   { return "task.stale_marker_reminder" }

func (t *StaleMarkerReminderTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	threshold := formatPositiveFloat(parsePositiveFloatParam(cfg, staleMarkerThresholdParam, staleMarkerThresholdHours))
	limit := strings.TrimSpace(cfg.Params[staleMarkerLimitParam])
	if limit == "" {
		limit = fmt.Sprintf("%d", staleMarkerLimitDefault)
	}

	return []model.ScheduledTaskParamDefinition{
		{
			Key:         staleMarkerThresholdParam,
			Label:       "提醒阈值（小时）",
			Description: "临时打标超过该时长仍未补全时触发提醒。",
			Type:        "text",
			Placeholder: formatPositiveFloat(staleMarkerThresholdHours),
			Value:       threshold,
		},
		{
			Key:         staleMarkerLimitParam,
			Label:       "最多返回数量",
			Description: "单次事件中包含的待补充打标数量。",
			Type:        "text",
			Placeholder: fmt.Sprintf("%d", staleMarkerLimitDefault),
			Value:       limit,
		},
	}
}

func (t *StaleMarkerReminderTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	thresholdHours := parsePositiveFloatParam(cfg, staleMarkerThresholdParam, staleMarkerThresholdHours)
	limit := parsePositiveIntParam(cfg, staleMarkerLimitParam, staleMarkerLimitDefault)

	cutoff := time.Now().Add(-time.Duration(thresholdHours * float64(time.Hour)))
	markers, err := repository.GetStaleMarkers(cutoff.Format("2006-01-02"), cutoff.Format("15:04:05"), limit)
	if err != nil {
		return nil, fmt.Errorf("查询临时打标失败: %w", err)
	}
	if len(markers) == 0 {
		return nil, nil
	}

	key := fmt.Sprintf("%d:%s:%s", len(markers), markers[0].LogDate, markers[0].LogTime)
	t.mu.Lock()
	if key == t.lastReminderKey && time.Since(t.lastReminderAt) < 2*time.Hour {
		t.mu.Unlock()
		return nil, nil
	}
	t.lastReminderKey = key
	t.lastReminderAt = time.Now()
	t.mu.Unlock()

	return map[string]string{
		"marker_count":    fmt.Sprintf("%d", len(markers)),
		"threshold_hours": formatPositiveFloat(thresholdHours),
		"oldest_marker":   markers[0].LogDate + " " + markers[0].LogTime,
		"detail":          formatMarkerDetail(markers),
		"message":         fmt.Sprintf("有 %d 个临时打标超过 %.1f 小时仍未补全", len(markers), thresholdHours),
		"timestamp":       time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}

func parsePositiveIntParam(cfg model.ScheduledTaskConfig, key string, fallback int) int {
	raw := strings.TrimSpace(cfg.Params[key])
	if raw == "" {
		return fallback
	}
	var value int
	if _, err := fmt.Sscanf(raw, "%d", &value); err != nil || value <= 0 {
		return fallback
	}
	return value
}

func formatMarkerDetail(markers []model.LogEntry) string {
	var sb strings.Builder
	sb.WriteString("临时打标待补充：\n")
	for _, marker := range markers {
		sb.WriteString(fmt.Sprintf("  - #%d %s %s\n", marker.ID, marker.LogDate, marker.LogTime[:5]))
	}
	return sb.String()
}
