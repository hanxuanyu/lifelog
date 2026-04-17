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

// Task defines a builtin scheduled task.
type Task interface {
	Name() string
	Description() string
	DefaultCron() string
	EventName() string
	ParameterDefinitions(model.ScheduledTaskConfig) []model.ScheduledTaskParamDefinition
	Execute(model.ScheduledTaskConfig) (map[string]string, error)
}

// TaskEntry stores the runtime state of a registered task.
type TaskEntry struct {
	Task    Task
	Config  model.ScheduledTaskConfig
	EntryID cron.EntryID
}

var (
	mu            sync.RWMutex
	cronRunner    *cron.Cron
	registeredMap = make(map[string]*TaskEntry)
	builtinTasks  []Task
)

// RegisterBuiltinTask registers a builtin task before Start is called.
func RegisterBuiltinTask(t Task) {
	mu.Lock()
	defer mu.Unlock()
	builtinTasks = append(builtinTasks, t)
}

// Start boots the scheduler and loads all builtin tasks from config.
func Start() {
	mu.Lock()
	defer mu.Unlock()

	if cronRunner != nil {
		slog.Warn("scheduler already started")
		return
	}

	cronRunner = cron.New(cron.WithSeconds())

	if err := ensureBuiltinTaskConfigs(); err != nil {
		slog.Error("failed to ensure builtin task configs", "error", err)
	}

	registeredMap = make(map[string]*TaskEntry, len(builtinTasks))
	for _, t := range builtinTasks {
		cfg := model.ScheduledTaskConfig{
			Name:    t.Name(),
			Cron:    t.DefaultCron(),
			Enabled: false,
		}
		if saved := config.GetScheduledTaskByName(t.Name()); saved != nil {
			cfg = copyScheduledTaskConfig(*saved)
			if cfg.Cron == "" {
				cfg.Cron = t.DefaultCron()
			}
		}

		entry := &TaskEntry{
			Task:   t,
			Config: cfg,
		}
		registeredMap[t.Name()] = entry

		if entry.Config.Enabled {
			if err := scheduleEntry(entry); err != nil {
				slog.Error("failed to schedule task", "task", t.Name(), "cron", entry.Config.Cron, "error", err)
			}
		}
	}

	cronRunner.Start()
	slog.Info("scheduler started", "tasks_count", len(registeredMap))
}

// Stop shuts down the scheduler.
func Stop() {
	mu.Lock()
	defer mu.Unlock()

	if cronRunner != nil {
		ctx := cronRunner.Stop()
		<-ctx.Done()
		cronRunner = nil
		slog.Info("scheduler stopped")
	}
}

func ensureBuiltinTaskConfigs() error {
	existing := config.GetScheduledTasks()
	existingMap := make(map[string]struct{}, len(existing))
	for _, cfg := range existing {
		existingMap[cfg.Name] = struct{}{}
	}

	changed := false
	for _, t := range builtinTasks {
		if _, ok := existingMap[t.Name()]; ok {
			continue
		}
		existing = append(existing, model.ScheduledTaskConfig{
			Name:    t.Name(),
			Cron:    t.DefaultCron(),
			Enabled: false,
		})
		changed = true
	}

	if !changed {
		return nil
	}
	return config.SetScheduledTasks(existing)
}

func scheduleEntry(entry *TaskEntry) error {
	if cronRunner == nil {
		return fmt.Errorf("scheduler not started")
	}

	id, err := cronRunner.AddFunc(entry.Config.Cron, func() {
		runTaskByName(entry.Task.Name())
	})
	if err != nil {
		return err
	}

	entry.EntryID = id
	slog.Info("scheduled task registered", "task", entry.Task.Name(), "cron", entry.Config.Cron)
	return nil
}

func unscheduleEntry(entry *TaskEntry) {
	if cronRunner == nil || entry.EntryID == 0 {
		return
	}
	cronRunner.Remove(entry.EntryID)
	entry.EntryID = 0
}

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

func runTaskByName(name string) {
	mu.RLock()
	entry, ok := registeredMap[name]
	if !ok {
		mu.RUnlock()
		slog.Warn("skip unknown scheduled task", "task", name)
		return
	}
	task := entry.Task
	cfg := copyScheduledTaskConfig(entry.Config)
	mu.RUnlock()

	runTask(task, cfg)
}

// MultiEventTask is optionally implemented by tasks that publish multiple event types.
// runTask checks all returned event names instead of just EventName().
type MultiEventTask interface {
	EventNames() []string
}

// WebhookIndependentTask is optionally implemented by tasks that do not require
// webhook bindings to execute. By default, tasks are skipped if no enabled webhook
// binding exists for their event. Implement this interface and return true to
// bypass that check.
type WebhookIndependentTask interface {
	WebhookIndependent() bool
}

func taskRequiresWebhook(task Task) bool {
	if wi, ok := task.(WebhookIndependentTask); ok {
		return !wi.WebhookIndependent()
	}
	return true
}

func runTask(task Task, cfg model.ScheduledTaskConfig) {
	start := time.Now()

	if taskRequiresWebhook(task) {
		if mt, ok := task.(MultiEventTask); ok {
			hasAny := false
			for _, name := range mt.EventNames() {
				if hasEnabledBindings(name) {
					hasAny = true
					break
				}
			}
			if !hasAny {
				slog.Info("scheduled task skipped because no enabled webhook bindings exist", "task", task.Name())
				return
			}
		} else if !hasEnabledBindings(task.EventName()) {
			slog.Info("scheduled task skipped because no enabled webhook bindings exist", "task", task.Name(), "event", task.EventName())
			return
		}
	}

	slog.Info("running scheduled task", "task", task.Name())

	defer func() {
		if r := recover(); r != nil {
			slog.Error("scheduled task panic", "task", task.Name(), "error", r)
		}
	}()

	data, err := task.Execute(cfg)
	if err != nil {
		slog.Error("scheduled task failed", "task", task.Name(), "error", err, "duration", time.Since(start))
		return
	}

	if data == nil {
		slog.Info("scheduled task produced no event data", "task", task.Name(), "duration", time.Since(start))
		return
	}

	if data["timestamp"] == "" {
		data["timestamp"] = time.Now().Format("2006-01-02 15:04:05")
	}

	events.Publish(task.EventName(), data)
	slog.Info("scheduled task finished", "task", task.Name(), "event", task.EventName(), "duration", time.Since(start))
}

// TaskInfo is the API payload for builtin tasks.
type TaskInfo struct {
	Name              string                               `json:"name"`
	Description       string                               `json:"description"`
	Cron              string                               `json:"cron"`
	Enabled           bool                                 `json:"enabled"`
	EventName         string                               `json:"event_name"`
	EventNames        []string                             `json:"event_names,omitempty"`
	DefaultCron       string                               `json:"default_cron"`
	NextRun           time.Time                            `json:"next_run,omitempty"`
	BoundWebhookCount int                                  `json:"bound_webhook_count"`
	RequiresWebhook   bool                                 `json:"requires_webhook"`
	ParamDefinitions  []model.ScheduledTaskParamDefinition `json:"param_definitions,omitempty"`
}

// GetTasks returns all registered builtin tasks.
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
			Name:             t.Name(),
			Description:      t.Description(),
			Cron:             entry.Config.Cron,
			Enabled:          entry.Config.Enabled,
			EventName:        t.EventName(),
			DefaultCron:      t.DefaultCron(),
			RequiresWebhook:  taskRequiresWebhook(t),
			ParamDefinitions: t.ParameterDefinitions(copyScheduledTaskConfig(entry.Config)),
		}

		if mt, ok := t.(MultiEventTask); ok {
			names := mt.EventNames()
			info.EventNames = names
			total := 0
			for _, name := range names {
				total += countEnabledBindings(name)
			}
			info.BoundWebhookCount = total
		} else {
			info.BoundWebhookCount = countEnabledBindings(t.EventName())
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

// UpdateTasks updates cron, enabled state, and task params, then persists and reschedules.
func UpdateTasks(updates []model.ScheduledTaskConfig) error {
	mu.Lock()
	defer mu.Unlock()

	parser := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	for _, u := range updates {
		entry, ok := registeredMap[u.Name]
		if !ok {
			return fmt.Errorf("unknown task: %s", u.Name)
		}
		if _, err := parser.Parse(u.Cron); err != nil {
			return fmt.Errorf("invalid cron for task %s: %w", u.Name, err)
		}
		if err := validateTaskParams(entry.Task, u.Params); err != nil {
			return err
		}
	}

	merged := mergeTaskConfigs(updates)
	if err := config.SetScheduledTasks(merged); err != nil {
		return err
	}

	for _, u := range updates {
		entry := registeredMap[u.Name]
		unscheduleEntry(entry)
		entry.Config.Cron = u.Cron
		entry.Config.Enabled = u.Enabled
		entry.Config.Params = copyStringMap(u.Params)
		if entry.Config.Enabled {
			if err := scheduleEntry(entry); err != nil {
				slog.Error("failed to reschedule task", "task", u.Name, "error", err)
			}
		}
	}

	return nil
}

func validateTaskParams(task Task, params map[string]string) error {
	if len(params) == 0 {
		return nil
	}

	allowed := make(map[string]struct{})
	for _, def := range task.ParameterDefinitions(model.ScheduledTaskConfig{Name: task.Name()}) {
		if def.ReadOnly {
			continue
		}
		allowed[def.Key] = struct{}{}
	}

	for key := range params {
		if _, ok := allowed[key]; !ok {
			return fmt.Errorf("task %s does not support parameter %s", task.Name(), key)
		}
	}
	return nil
}

func mergeTaskConfigs(updates []model.ScheduledTaskConfig) []model.ScheduledTaskConfig {
	updateMap := make(map[string]model.ScheduledTaskConfig, len(updates))
	for _, u := range updates {
		updateMap[u.Name] = u
	}

	result := make([]model.ScheduledTaskConfig, 0, len(registeredMap))
	for _, t := range builtinTasks {
		entry := registeredMap[t.Name()]
		cfg := copyScheduledTaskConfig(entry.Config)
		if u, ok := updateMap[t.Name()]; ok {
			cfg.Cron = u.Cron
			cfg.Enabled = u.Enabled
			if u.Params != nil {
				cfg.Params = copyStringMap(u.Params)
			}
		}
		result = append(result, cfg)
	}

	return result
}

// RunTaskNow triggers a task immediately in the background.
func RunTaskNow(name string) error {
	mu.RLock()
	_, ok := registeredMap[name]
	mu.RUnlock()

	if !ok {
		return fmt.Errorf("unknown task: %s", name)
	}

	go runTaskByName(name)
	return nil
}

// ReloadFromConfig reloads all task configs from the config file and reschedules.
func ReloadFromConfig() {
	mu.Lock()
	defer mu.Unlock()

	if cronRunner == nil {
		return
	}

	for _, entry := range registeredMap {
		unscheduleEntry(entry)

		saved := config.GetScheduledTaskByName(entry.Task.Name())
		if saved != nil {
			entry.Config = copyScheduledTaskConfig(*saved)
			if entry.Config.Cron == "" {
				entry.Config.Cron = entry.Task.DefaultCron()
			}
		}

		if entry.Config.Enabled {
			if err := scheduleEntry(entry); err != nil {
				slog.Error("failed to reschedule task after reload", "task", entry.Task.Name(), "error", err)
			}
		}
	}

	slog.Info("scheduler reloaded from config")
}

func copyScheduledTaskConfig(cfg model.ScheduledTaskConfig) model.ScheduledTaskConfig {
	cfg.Params = copyStringMap(cfg.Params)
	return cfg
}

func copyStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}

	result := make(map[string]string, len(input))
	for key, value := range input {
		result[key] = value
	}
	return result
}
