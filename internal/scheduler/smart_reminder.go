package scheduler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
)

// Checkpoint represents a single smart reminder checkpoint.
type Checkpoint struct {
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	ExpectedTime      string   `json:"expected_time"`
	TimeWindowMinutes int      `json:"time_window_minutes"`
	EventPatterns     []string `json:"event_patterns"`
	Category          string   `json:"category"`
	Message           string   `json:"message"`
	Enabled           bool     `json:"enabled"`
}

// CheckpointFile is the top-level structure of smart_checkpoints.json.
type CheckpointFile struct {
	GeneratedAt   string       `json:"generated_at"`
	AnalysisRange string       `json:"analysis_range"`
	Checkpoints   []Checkpoint `json:"checkpoints"`
}

func checkpointFilePath() string {
	return filepath.Join(filepath.Dir(config.GetDBPath()), "smart_checkpoints.json")
}

func loadCheckpointFile() (*CheckpointFile, error) {
	data, err := os.ReadFile(checkpointFilePath())
	if err != nil {
		return nil, err
	}
	var cf CheckpointFile
	if err := json.Unmarshal(data, &cf); err != nil {
		return nil, fmt.Errorf("解析检查点文件失败: %w", err)
	}
	return &cf, nil
}

func saveCheckpointFile(cf *CheckpointFile) error {
	path := checkpointFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}
	data, err := json.MarshalIndent(cf, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化检查点失败: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

// --- Analyze Task ---

const (
	smartAnalyzeDaysParam   = "analysis_days"
	smartAnalyzePromptParam = "prompt_name"
	smartAnalyzeDefaultDays = 14
	smartAnalyzeDefaultPrompt = "smart_reminder_analyze"
	smartReminderEvent      = "task.smart_reminder"
)

type SmartReminderAnalyzeTask struct{}

func (t *SmartReminderAnalyzeTask) Name() string             { return "smart_reminder_analyze" }
func (t *SmartReminderAnalyzeTask) Description() string      { return "智能提醒 - 模式分析" }
func (t *SmartReminderAnalyzeTask) DefaultCron() string      { return "0 0 3 * * 1" }
func (t *SmartReminderAnalyzeTask) EventName() string        { return smartReminderEvent }
func (t *SmartReminderAnalyzeTask) WebhookIndependent() bool { return true }

// PLACEHOLDER_ANALYZE_PARAMS

func (t *SmartReminderAnalyzeTask) ParameterDefinitions(cfg model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	days := formatPositiveFloat(parsePositiveFloatParam(cfg, smartAnalyzeDaysParam, smartAnalyzeDefaultDays))

	allPrompts := config.GetAllPrompts()
	options := make([]model.ParamOption, 0, len(allPrompts))
	for _, p := range allPrompts {
		label := p.Description
		if label == "" {
			label = p.Name
		}
		if p.Builtin {
			label += "（内置）"
		}
		options = append(options, model.ParamOption{Label: label, Value: p.Name})
	}

	promptName := strings.TrimSpace(cfg.Params[smartAnalyzePromptParam])
	if promptName == "" {
		promptName = smartAnalyzeDefaultPrompt
	}

	return []model.ScheduledTaskParamDefinition{
		{
			Key:         smartAnalyzeDaysParam,
			Label:       "分析天数",
			Description: "分析最近多少天的日志数据来识别行为模式。",
			Type:        "text",
			Placeholder: fmt.Sprintf("%d", smartAnalyzeDefaultDays),
			Value:       days,
		},
		{
			Key:         smartAnalyzePromptParam,
			Label:       "分析提示词",
			Description: "选择用于分析行为模式的系统提示词。",
			Type:        "select",
			Options:     options,
			Value:       promptName,
		},
	}
}

func (t *SmartReminderAnalyzeTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	provider := config.GetDefaultAIProvider()
	if provider == nil {
		return nil, fmt.Errorf("未配置 AI 服务商")
	}

	days := int(parsePositiveFloatParam(cfg, smartAnalyzeDaysParam, smartAnalyzeDefaultDays))
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")

	logContext, err := service.BuildLogContext(startDate, endDate, nil)
	if err != nil {
		return nil, fmt.Errorf("构建日志上下文失败: %w", err)
	}

	promptName := strings.TrimSpace(cfg.Params[smartAnalyzePromptParam])
	if promptName == "" {
		promptName = smartAnalyzeDefaultPrompt
	}
	prompt := config.GetPromptByName(promptName)
	if prompt == nil {
		prompt = config.GetPromptByName(smartAnalyzeDefaultPrompt)
	}
	systemPrompt := ""
	if prompt != nil {
		systemPrompt = strings.TrimSpace(prompt.Content)
	}

	userPrompt := fmt.Sprintf("请分析以下 %s 至 %s 的日志数据，识别规律性活动并生成检查点 JSON 数组。\n\n%s", startDate, endDate, logContext)

	content, err := service.ChatCompletion(*provider, systemPrompt, []model.AIChatMessage{
		{Role: "user", Content: userPrompt},
	})
	if err != nil {
		return nil, fmt.Errorf("AI 分析失败: %w", err)
	}

	checkpoints, err := parseCheckpointsFromAI(content)
	if err != nil {
		return nil, fmt.Errorf("解析 AI 响应失败: %w", err)
	}

	cf := &CheckpointFile{
		GeneratedAt:   time.Now().Format(time.RFC3339),
		AnalysisRange: fmt.Sprintf("%s ~ %s", startDate, endDate),
		Checkpoints:   checkpoints,
	}
	if err := saveCheckpointFile(cf); err != nil {
		return nil, fmt.Errorf("保存检查点文件失败: %w", err)
	}

	slog.Info("smart reminder checkpoints updated", "count", len(checkpoints), "range", cf.AnalysisRange)

	return map[string]string{
		"checkpoint_name":        "analysis_complete",
		"checkpoint_description": "检查点分析完成",
		"expected_time":          "",
		"category":               "",
		"message":                fmt.Sprintf("智能提醒分析完成，共生成 %d 个检查点（分析范围：%s）", len(checkpoints), cf.AnalysisRange),
		"timestamp":              time.Now().Format("2006-01-02 15:04:05"),
	}, nil
}

// PLACEHOLDER_PARSE_AND_CHECK

func parseCheckpointsFromAI(content string) ([]Checkpoint, error) {
	content = strings.TrimSpace(content)

	// Strip markdown code fences if present
	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		start, end := 0, len(lines)
		for i, line := range lines {
			if strings.HasPrefix(strings.TrimSpace(line), "```") {
				if start == 0 {
					start = i + 1
				} else {
					end = i
					break
				}
			}
		}
		content = strings.Join(lines[start:end], "\n")
	}
	content = strings.TrimSpace(content)

	// Try to extract JSON array if wrapped in other text
	if idx := strings.Index(content, "["); idx >= 0 {
		if endIdx := strings.LastIndex(content, "]"); endIdx > idx {
			content = content[idx : endIdx+1]
		}
	}

	var checkpoints []Checkpoint
	if err := json.Unmarshal([]byte(content), &checkpoints); err != nil {
		return nil, fmt.Errorf("JSON 解析失败: %w", err)
	}

	for i := range checkpoints {
		checkpoints[i].Enabled = true
	}
	return checkpoints, nil
}

// --- Check Task ---

type SmartReminderCheckTask struct {
	mu         sync.Mutex
	firedToday map[string]string // checkpoint name -> date
}

func (t *SmartReminderCheckTask) Name() string        { return "smart_reminder_check" }
func (t *SmartReminderCheckTask) Description() string { return "智能提醒 - 检查点检测" }
func (t *SmartReminderCheckTask) DefaultCron() string { return "0 */15 * * * *" }
func (t *SmartReminderCheckTask) EventName() string   { return smartReminderEvent }

func (t *SmartReminderCheckTask) ParameterDefinitions(model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition {
	cf, err := loadCheckpointFile()
	statusValue := "未生成"
	if err == nil && cf != nil {
		statusValue = fmt.Sprintf("共 %d 个检查点（%s 生成，分析范围：%s）",
			len(cf.Checkpoints), cf.GeneratedAt, cf.AnalysisRange)
	}
	return []model.ScheduledTaskParamDefinition{
		{
			Key:      "checkpoint_status",
			Label:    "检查点状态",
			Type:     "text",
			Value:    statusValue,
			ReadOnly: true,
		},
	}
}

// PLACEHOLDER_CHECK_EXECUTE

func (t *SmartReminderCheckTask) Execute(cfg model.ScheduledTaskConfig) (map[string]string, error) {
	now := time.Now()
	today := now.Format("2006-01-02")

	cf, err := loadCheckpointFile()
	if err != nil {
		slog.Debug("smart reminder check: no checkpoint file", "error", err)
		return nil, nil
	}
	if len(cf.Checkpoints) == 0 {
		return nil, nil
	}

	entries, err := repository.GetTimelineEntries(today)
	if err != nil {
		return nil, nil
	}

	t.mu.Lock()
	if t.firedToday == nil {
		t.firedToday = make(map[string]string)
	}
	for name, d := range t.firedToday {
		if d != today {
			delete(t.firedToday, name)
		}
	}
	t.mu.Unlock()

	for _, cp := range cf.Checkpoints {
		if !cp.Enabled {
			continue
		}

		t.mu.Lock()
		if t.firedToday[cp.Name] == today {
			t.mu.Unlock()
			continue
		}
		t.mu.Unlock()

		expectedTime, err := time.ParseInLocation("2006-01-02 15:04", today+" "+cp.ExpectedTime, time.Local)
		if err != nil {
			slog.Warn("smart reminder: invalid expected_time", "checkpoint", cp.Name, "time", cp.ExpectedTime)
			continue
		}

		windowEnd := expectedTime.Add(time.Duration(cp.TimeWindowMinutes) * time.Minute)
		if now.Before(expectedTime) || now.After(windowEnd) {
			continue
		}

		if matchesAnyEntry(entries, cp.EventPatterns) {
			continue
		}

		t.mu.Lock()
		t.firedToday[cp.Name] = today
		t.mu.Unlock()

		events.Publish(smartReminderEvent, map[string]string{
			"checkpoint_name":        cp.Name,
			"checkpoint_description": cp.Description,
			"expected_time":          cp.ExpectedTime,
			"category":               cp.Category,
			"message":                cp.Message,
			"timestamp":              now.Format("2006-01-02 15:04:05"),
		})
		slog.Info("smart reminder fired", "checkpoint", cp.Name, "message", cp.Message)
	}

	return nil, nil
}

func matchesAnyEntry(entries []model.LogEntry, patterns []string) bool {
	for _, entry := range entries {
		for _, pattern := range patterns {
			if strings.Contains(entry.EventType, pattern) {
				return true
			}
		}
	}
	return false
}
