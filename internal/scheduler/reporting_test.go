package scheduler

import (
	"strings"
	"testing"

	"github.com/hxuanyu/lifelog/internal/model"
)

func TestBuildFallbackDailyReportUsesMarkdownSections(t *testing.T) {
	report := buildFallbackDailyReport(&model.DailyStatistics{
		Date:          "2026-04-10",
		TotalKnown:    8100,
		TimePointMode: "end",
		Summary: []model.CategorySummary{
			{Category: "Work", Duration: 5400, Display: "1h30m", Percentage: 66.7},
			{Category: "Growth", Duration: 2700, Display: "45m", Percentage: 33.3},
		},
		Items: []model.DurationItem{
			{EventType: "Meeting", Category: "Work", Duration: 5400, Display: "1h30m", StartTime: "09:00", EndTime: "10:30"},
			{EventType: "Study", Category: "Growth", Duration: 2700, Display: "45m", StartTime: "11:00", EndTime: "11:45"},
			{EventType: "Lunch", Category: "Food", Unknown: true, StartTime: "12:00"},
		},
		CrossDayHints: []model.CrossDayHint{
			{EventType: "Sleep", Category: "Rest", StartTime: "00:00", EndTime: "07:30", Direction: "prev"},
		},
	})

	wants := []string{
		"# 2026-04-10",
		"##",
		"`09:00-10:30`",
	}

	for _, want := range wants {
		if !strings.Contains(report, want) {
			t.Fatalf("daily fallback report missing %q:\n%s", want, report)
		}
	}
}

func TestBuildFallbackPeriodReportUsesMarkdownSections(t *testing.T) {
	report := buildFallbackPeriodReport("Weekly Report", &model.PeriodStatistics{
		StartDate:  "2026-04-06",
		EndDate:    "2026-04-12",
		DayCount:   7,
		TotalKnown: 19800,
		Summary: []model.CategorySummary{
			{Category: "Work", Duration: 12600, Display: "3h30m", Percentage: 63.6},
			{Category: "Growth", Duration: 7200, Display: "2h", Percentage: 36.4},
		},
		Items: []model.DurationItem{
			{EventType: "Meeting", Category: "Work", Duration: 7200, Display: "2h", StartTime: "09:00", EndTime: "11:00"},
			{EventType: "Coding", Category: "Work", Duration: 5400, Display: "1h30m", StartTime: "14:00", EndTime: "15:30"},
			{EventType: "Study", Category: "Growth", Duration: 7200, Display: "2h", StartTime: "20:00", EndTime: "22:00"},
		},
	})

	wants := []string{
		"# Weekly Report",
		"##",
		"Meeting",
	}

	for _, want := range wants {
		if !strings.Contains(report, want) {
			t.Fatalf("period fallback report missing %q:\n%s", want, report)
		}
	}
}

func TestBuildScheduledReportSystemPromptAppendsCustomPrompt(t *testing.T) {
	got := buildScheduledReportSystemPrompt(model.ScheduledTaskConfig{
		Params: map[string]string{
			reportCustomPromptParam: "Focus on sleep rhythm.",
		},
	})

	if !strings.Contains(got, "Focus on sleep rhythm.") {
		t.Fatalf("expected custom prompt to be appended, got:\n%s", got)
	}
	if !strings.Contains(got, "用户自定义指令") {
		t.Fatalf("expected custom prompt section header, got:\n%s", got)
	}
}

func TestBuildScheduledReportSystemPromptFallsBackToCustomPromptWhenBasePromptMissing(t *testing.T) {
	got := buildScheduledReportSystemPrompt(model.ScheduledTaskConfig{
		Params: map[string]string{
			reportPromptNameParam:   "missing_prompt",
			reportCustomPromptParam: "Only return the conclusion.",
		},
	})

	if !strings.Contains(got, "Only return the conclusion.") {
		t.Fatalf("expected custom prompt to be present, got:\n%s", got)
	}
}

func TestNoLogReminderParameterDefinitionsUseConfiguredThreshold(t *testing.T) {
	task := &NoLogReminderTask{}
	defs := task.ParameterDefinitions(model.ScheduledTaskConfig{
		Name: "no_log_reminder",
		Params: map[string]string{
			noLogReminderThresholdParam: "1.5",
		},
	})

	if len(defs) != 1 {
		t.Fatalf("expected 1 parameter definition, got %d", len(defs))
	}
	if defs[0].Key != noLogReminderThresholdParam {
		t.Fatalf("unexpected parameter key: %s", defs[0].Key)
	}
	if defs[0].Value != "1.5" {
		t.Fatalf("expected configured threshold to be reflected, got %q", defs[0].Value)
	}
}
