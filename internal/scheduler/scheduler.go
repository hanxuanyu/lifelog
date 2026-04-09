package scheduler

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/robfig/cron/v3"
)

// Task 定时任务接口
type Task interface {
	Name() string                           // 任务唯一标识
	Description() string                    // 任务描述
	DefaultCron() string                    // 默认 cron 表达式
	EventName() string                      // 执行完成后发布的事件名
	Execute() (map[string]string, error)    // 执行任务并返回事件数据
}

// TaskEntry 已注册任务的状态
type TaskEntry struct {
	Task     Task
	CronExpr string
	Enabled  bool
	EntryID  cron.EntryID // 0 表示未调度
}

var (
	mu            sync.RWMutex
	cronRunner    *cron.Cron
	registeredMap = make(map[string]*TaskEntry)
	builtinTasks  []Task
)

// RegisterBuiltinTask 注册内置任务（在 Start 之前调用）
func RegisterBuiltinTask(t Task) {
	mu.Lock()
	defer mu.Unlock()
	builtinTasks = append(builtinTasks, t)
}

// Start 启动调度器并加载所有任务
func Start() {
	mu.Lock()
	defer mu.Unlock()

	if cronRunner != nil {
		slog.Warn("调度器已经启动")
		return
	}

	// 使用标准 5 字段 cron（分、时、日、月、周），支持秒可选的话可以使用 WithSeconds
	cronRunner = cron.New()

	// 确保配置中存在所有内置任务（缺失则添加默认配置）
	if err := ensureBuiltinTaskConfigs(); err != nil {
		slog.Error("确保内置任务配置失败", "error", err)
	}

	// 根据配置注册到 cron
	for _, t := range builtinTasks {
		entry := &TaskEntry{
			Task:     t,
			CronExpr: t.DefaultCron(),
			Enabled:  true,
		}
		if cfg := config.GetScheduledTaskByName(t.Name()); cfg != nil {
			if cfg.Cron != "" {
				entry.CronExpr = cfg.Cron
			}
			entry.Enabled = cfg.Enabled
		}
		registeredMap[t.Name()] = entry

		if entry.Enabled {
			if err := scheduleEntry(entry); err != nil {
				slog.Error("注册定时任务失败", "task", t.Name(), "cron", entry.CronExpr, "error", err)
			}
		}
	}

	cronRunner.Start()
	slog.Info("调度器已启动", "tasks_count", len(registeredMap))
}

// Stop 停止调度器
func Stop() {
	mu.Lock()
	defer mu.Unlock()

	if cronRunner != nil {
		ctx := cronRunner.Stop()
		<-ctx.Done()
		cronRunner = nil
		slog.Info("调度器已停止")
	}
}

// ensureBuiltinTaskConfigs 如果配置中缺少内置任务项则补充默认值
func ensureBuiltinTaskConfigs() error {
	existing := config.GetScheduledTasks()
	existingMap := make(map[string]struct{}, len(existing))
	for _, cfg := range existing {
		existingMap[cfg.Name] = struct{}{}
	}

	changed := false
	for _, t := range builtinTasks {
		if _, ok := existingMap[t.Name()]; !ok {
			existing = append(existing, model.ScheduledTaskConfig{
				Name:    t.Name(),
				Cron:    t.DefaultCron(),
				Enabled: true,
			})
			changed = true
		}
	}

	if changed {
		return config.SetScheduledTasks(existing)
	}
	return nil
}

// scheduleEntry 将任务加入 cron；调用方需持锁
func scheduleEntry(entry *TaskEntry) error {
	if cronRunner == nil {
		return fmt.Errorf("调度器未启动")
	}
	id, err := cronRunner.AddFunc(entry.CronExpr, func() {
		runTask(entry.Task)
	})
	if err != nil {
		return err
	}
	entry.EntryID = id
	slog.Info("定时任务已注册", "task", entry.Task.Name(), "cron", entry.CronExpr)
	return nil
}

// unscheduleEntry 从 cron 中移除任务；调用方需持锁
func unscheduleEntry(entry *TaskEntry) {
	if cronRunner == nil || entry.EntryID == 0 {
		return
	}
	cronRunner.Remove(entry.EntryID)
	entry.EntryID = 0
}

// hasEnabledBindings 检查事件是否有已启用的下游 webhook 绑定
func hasEnabledBindings(eventName string) bool {
	for _, b := range config.GetEventBindings() {
		if b.Event == eventName && b.Enabled && b.WebhookName != "" {
			if config.GetWebhookByName(b.WebhookName) != nil {
				return true
			}
		}
	}
	return false
}

// countEnabledBindings 统计事件已启用的下游 webhook 绑定数
func countEnabledBindings(eventName string) int {
	count := 0
	for _, b := range config.GetEventBindings() {
		if b.Event == eventName && b.Enabled && b.WebhookName != "" {
			if config.GetWebhookByName(b.WebhookName) != nil {
				count++
			}
		}
	}
	return count
}

// runTask 执行一次任务并发布事件
func runTask(t Task) {
	start := time.Now()

	// 检查是否有下游 webhook 绑定，无绑定则跳过执行
	if !hasEnabledBindings(t.EventName()) {
		slog.Info("定时任务跳过：事件无已启用的 webhook 绑定", "task", t.Name(), "event", t.EventName())
		return
	}

	slog.Info("开始执行定时任务", "task", t.Name())

	defer func() {
		if r := recover(); r != nil {
			slog.Error("定时任务 panic", "task", t.Name(), "error", r)
		}
	}()

	data, err := t.Execute()
	if err != nil {
		slog.Error("定时任务执行失败", "task", t.Name(), "error", err, "duration", time.Since(start))
		// 即使失败也可以发布事件（包含错误信息），但这里先简单记录
		return
	}

	if data == nil {
		// 任务可以返回 nil data 表示不需要发布事件（例如无日志提醒时没到阈值）
		slog.Info("定时任务无需发布事件", "task", t.Name(), "duration", time.Since(start))
		return
	}

	if data["timestamp"] == "" {
		data["timestamp"] = time.Now().Format("2006-01-02 15:04:05")
	}

	events.Publish(t.EventName(), data)
	slog.Info("定时任务执行完成", "task", t.Name(), "event", t.EventName(), "duration", time.Since(start))
}

// TaskInfo 对外暴露的任务信息
type TaskInfo struct {
	Name              string    `json:"name"`
	Description       string    `json:"description"`
	Cron              string    `json:"cron"`
	Enabled           bool      `json:"enabled"`
	EventName         string    `json:"event_name"`
	DefaultCron       string    `json:"default_cron"`
	NextRun           time.Time `json:"next_run,omitempty"`
	BoundWebhookCount int       `json:"bound_webhook_count"`
}

// GetTasks 返回所有注册的任务信息
func GetTasks() []TaskInfo {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]TaskInfo, 0, len(builtinTasks))
	for _, t := range builtinTasks {
		entry, ok := registeredMap[t.Name()]
		if !ok {
			continue
		}
		info := TaskInfo{
			Name:              t.Name(),
			Description:       t.Description(),
			Cron:              entry.CronExpr,
			Enabled:           entry.Enabled,
			EventName:         t.EventName(),
			DefaultCron:       t.DefaultCron(),
			BoundWebhookCount: countEnabledBindings(t.EventName()),
		}
		if cronRunner != nil && entry.EntryID != 0 {
			e := cronRunner.Entry(entry.EntryID)
			if !e.Next.IsZero() {
				info.NextRun = e.Next
			}
		}
		result = append(result, info)
	}
	return result
}

// UpdateTasks 批量更新任务配置（cron + enabled），持久化并重新调度
func UpdateTasks(updates []model.ScheduledTaskConfig) error {
	mu.Lock()
	defer mu.Unlock()

	// 校验 cron 表达式
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	for _, u := range updates {
		if _, ok := registeredMap[u.Name]; !ok {
			return fmt.Errorf("未知的任务: %s", u.Name)
		}
		if _, err := parser.Parse(u.Cron); err != nil {
			return fmt.Errorf("任务 %s 的 cron 表达式无效: %w", u.Name, err)
		}
	}

	// 持久化
	merged := mergeTaskConfigs(updates)
	if err := config.SetScheduledTasks(merged); err != nil {
		return err
	}

	// 重新调度
	for _, u := range updates {
		entry := registeredMap[u.Name]
		unscheduleEntry(entry)
		entry.CronExpr = u.Cron
		entry.Enabled = u.Enabled
		if entry.Enabled {
			if err := scheduleEntry(entry); err != nil {
				slog.Error("重新注册定时任务失败", "task", u.Name, "error", err)
			}
		}
	}

	return nil
}

// mergeTaskConfigs 合并用户提交的更新和已注册任务的完整配置
func mergeTaskConfigs(updates []model.ScheduledTaskConfig) []model.ScheduledTaskConfig {
	updateMap := make(map[string]model.ScheduledTaskConfig, len(updates))
	for _, u := range updates {
		updateMap[u.Name] = u
	}
	result := make([]model.ScheduledTaskConfig, 0, len(registeredMap))
	for _, t := range builtinTasks {
		entry := registeredMap[t.Name()]
		cfg := model.ScheduledTaskConfig{
			Name:    t.Name(),
			Cron:    entry.CronExpr,
			Enabled: entry.Enabled,
		}
		if u, ok := updateMap[t.Name()]; ok {
			cfg.Cron = u.Cron
			cfg.Enabled = u.Enabled
		}
		result = append(result, cfg)
	}
	return result
}

// RunTaskNow 手动触发任务（异步执行）
func RunTaskNow(name string) error {
	mu.RLock()
	entry, ok := registeredMap[name]
	mu.RUnlock()

	if !ok {
		return fmt.Errorf("未知的任务: %s", name)
	}
	go runTask(entry.Task)
	return nil
}
