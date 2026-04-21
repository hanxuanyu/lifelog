package scheduler

import (
	"strings"
	"testing"
	"time"

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

	if len(defs) != 3 {
		t.Fatalf("expected 3 parameter definitions, got %d", len(defs))
	}
	if defs[0].Key != noLogReminderThresholdParam {
		t.Fatalf("unexpected parameter key: %s", defs[0].Key)
	}
	if defs[0].Value != "1.5" {
		t.Fatalf("expected configured threshold to be reflected, got %q", defs[0].Value)
	}
	if defs[1].Key != noLogReminderQuietStartParam || defs[1].Value != noLogReminderQuietStartDefault {
		t.Fatalf("unexpected quiet_start definition: key=%s value=%s", defs[1].Key, defs[1].Value)
	}
	if defs[2].Key != noLogReminderQuietEndParam || defs[2].Value != noLogReminderQuietEndDefault {
		t.Fatalf("unexpected quiet_end definition: key=%s value=%s", defs[2].Key, defs[2].Value)
	}
}

func TestIsInQuietHours(t *testing.T) {
	tests := []struct {
		name   string
		hour   int
		minute int
		startH int
		startM int
		endH   int
		endM   int
		want   bool
	}{
		{"midnight in quiet", 0, 30, 23, 0, 7, 0, true},
		{"23:30 in quiet", 23, 30, 23, 0, 7, 0, true},
		{"23:00 boundary start", 23, 0, 23, 0, 7, 0, true},
		{"06:59 still quiet", 6, 59, 23, 0, 7, 0, true},
		{"07:00 boundary end", 7, 0, 23, 0, 7, 0, false},
		{"12:00 not quiet", 12, 0, 23, 0, 7, 0, false},
		{"22:59 not quiet", 22, 59, 23, 0, 7, 0, false},
		{"09:00 in same-day", 9, 0, 9, 0, 12, 0, true},
		{"11:59 in same-day", 11, 59, 9, 0, 12, 0, true},
		{"12:00 out same-day", 12, 0, 9, 0, 12, 0, false},
		{"08:59 out same-day", 8, 59, 9, 0, 12, 0, false},
		{"same time disabled", 12, 0, 12, 0, 12, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Date(2026, 4, 21, tt.hour, tt.minute, 0, 0, time.Local)
			got := isInQuietHours(now, tt.startH, tt.startM, tt.endH, tt.endM)
			if got != tt.want {
				t.Errorf("isInQuietHours(%02d:%02d, %02d:%02d-%02d:%02d) = %v, want %v",
					tt.hour, tt.minute, tt.startH, tt.startM, tt.endH, tt.endM, got, tt.want)
			}
		})
	}
}

func TestParseHHMM(t *testing.T) {
	tests := []struct {
		input   string
		wantH   int
		wantM   int
		wantErr bool
	}{
		{"23:00", 23, 0, false},
		{"07:00", 7, 0, false},
		{"0:00", 0, 0, false},
		{"12:30", 12, 30, false},
		{"25:00", 0, 0, true},
		{"12:60", 0, 0, true},
		{"abc", 0, 0, true},
		{"", 0, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			h, m, err := parseHHMM(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseHHMM(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if !tt.wantErr && (h != tt.wantH || m != tt.wantM) {
				t.Fatalf("parseHHMM(%q) = (%d, %d), want (%d, %d)", tt.input, h, m, tt.wantH, tt.wantM)
			}
		})
	}
}
