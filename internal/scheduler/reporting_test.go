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
			{Category: "工作", Duration: 5400, Display: "1h30m", Percentage: 66.7},
			{Category: "成长", Duration: 2700, Display: "45m", Percentage: 33.3},
		},
		Items: []model.DurationItem{
			{EventType: "开会", Category: "工作", Duration: 5400, Display: "1h30m", StartTime: "09:00", EndTime: "10:30"},
			{EventType: "学习", Category: "成长", Duration: 2700, Display: "45m", StartTime: "11:00", EndTime: "11:45"},
			{EventType: "午饭", Category: "吃喝", Unknown: true, StartTime: "12:00"},
		},
		CrossDayHints: []model.CrossDayHint{
			{EventType: "睡觉", Category: "休息", StartTime: "00:00", EndTime: "07:30", Direction: "prev"},
		},
	})

	wants := []string{
		"# 2026-04-10 日报",
		"## 概览",
		"## 分类投入",
		"## 时间轴",
		"## 跨日提示",
		"`09:00-10:30` · `开会`",
	}

	for _, want := range wants {
		if !strings.Contains(report, want) {
			t.Fatalf("daily fallback report missing %q:\n%s", want, report)
		}
	}
}

func TestBuildFallbackPeriodReportUsesMarkdownSections(t *testing.T) {
	report := buildFallbackPeriodReport("周报", &model.PeriodStatistics{
		StartDate:  "2026-04-06",
		EndDate:    "2026-04-12",
		DayCount:   7,
		TotalKnown: 19800,
		Summary: []model.CategorySummary{
			{Category: "工作", Duration: 12600, Display: "3h30m", Percentage: 63.6},
			{Category: "成长", Duration: 7200, Display: "2h", Percentage: 36.4},
		},
		Items: []model.DurationItem{
			{EventType: "开会", Category: "工作", Duration: 7200, Display: "2h", StartTime: "09:00", EndTime: "11:00"},
			{EventType: "编码", Category: "工作", Duration: 5400, Display: "1h30m", StartTime: "14:00", EndTime: "15:30"},
			{EventType: "学习", Category: "成长", Duration: 7200, Display: "2h", StartTime: "20:00", EndTime: "22:00"},
			{EventType: "复盘", Category: "成长", Unknown: true, StartTime: "22:30"},
		},
	})

	wants := []string{
		"# 周报",
		"## 概览",
		"## 分类投入",
		"## 高频活动",
		"## 重点片段",
		"**开会** · 工作",
	}

	for _, want := range wants {
		if !strings.Contains(report, want) {
			t.Fatalf("period fallback report missing %q:\n%s", want, report)
		}
	}
}
