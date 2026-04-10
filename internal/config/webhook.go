package config

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/hxuanyu/lifelog/internal/model"
)

var (
	webhooks       []model.Webhook
	eventBindings  []model.EventBinding
	scheduledTasks []model.ScheduledTaskConfig
)

func loadWebhooks() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.Webhook
	if err := webhookViper.UnmarshalKey("webhooks", &items); err != nil {
		slog.Error("failed to parse webhook config", "error", err)
		return
	}

	webhooks = normalizeWebhooks(items)
	slog.Info("webhook config loaded", "count", len(webhooks))
}

func loadEventBindings() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.EventBinding
	if err := webhookViper.UnmarshalKey("event_bindings", &items); err != nil {
		slog.Error("failed to parse event bindings", "error", err)
		return
	}

	eventBindings = normalizeEventBindings(items)
	slog.Info("event bindings loaded", "count", len(eventBindings))
}

// GetWebhooks returns all configured webhooks.
func GetWebhooks() []model.Webhook {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.Webhook, len(webhooks))
	copy(result, webhooks)
	return result
}

// GetWebhookByName returns a webhook by name.
func GetWebhookByName(name string) *model.Webhook {
	mu.RLock()
	defer mu.RUnlock()

	for _, item := range webhooks {
		if item.Name == name {
			cp := item
			return &cp
		}
	}
	return nil
}

// SetWebhooks persists webhook config into webhooks.yaml.
func SetWebhooks(items []model.Webhook) error {
	normalized, err := validateWebhooks(items)
	if err != nil {
		return err
	}

	webhookViper.Set("webhooks", normalized)
	if err := webhookViper.WriteConfig(); err != nil {
		return err
	}
	loadWebhooks()
	return nil
}

// GetEventBindings returns all event bindings.
func GetEventBindings() []model.EventBinding {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.EventBinding, len(eventBindings))
	copy(result, eventBindings)
	return result
}

// GetEventBinding returns an event binding by event name.
func GetEventBinding(eventName string) *model.EventBinding {
	mu.RLock()
	defer mu.RUnlock()

	for _, item := range eventBindings {
		if item.Event == eventName {
			cp := item
			return &cp
		}
	}
	return nil
}

// SetEventBindings persists event bindings into webhooks.yaml.
func SetEventBindings(items []model.EventBinding) error {
	normalized, err := validateEventBindings(items)
	if err != nil {
		return err
	}

	webhookViper.Set("event_bindings", normalized)
	if err := webhookViper.WriteConfig(); err != nil {
		return err
	}
	loadEventBindings()
	return nil
}

func loadScheduledTasks() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.ScheduledTaskConfig
	if err := webhookViper.UnmarshalKey("scheduled_tasks", &items); err != nil {
		slog.Error("failed to parse scheduled tasks", "error", err)
		return
	}

	scheduledTasks = normalizeScheduledTasks(items)
	slog.Info("scheduled tasks loaded", "count", len(scheduledTasks))
}

// GetScheduledTasks 返回所有定时任务配置
func GetScheduledTasks() []model.ScheduledTaskConfig {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.ScheduledTaskConfig, len(scheduledTasks))
	copy(result, scheduledTasks)
	return result
}

// GetScheduledTaskByName 根据任务名查找配置
func GetScheduledTaskByName(name string) *model.ScheduledTaskConfig {
	mu.RLock()
	defer mu.RUnlock()

	for _, item := range scheduledTasks {
		if item.Name == name {
			cp := item
			return &cp
		}
	}
	return nil
}

// SetScheduledTasks 持久化定时任务配置到 webhooks.yaml
func SetScheduledTasks(items []model.ScheduledTaskConfig) error {
	normalized, err := validateScheduledTasks(items)
	if err != nil {
		return err
	}

	webhookViper.Set("scheduled_tasks", normalized)
	if err := webhookViper.WriteConfig(); err != nil {
		return err
	}
	loadScheduledTasks()
	return nil
}

func normalizeScheduledTasks(items []model.ScheduledTaskConfig) []model.ScheduledTaskConfig {
	normalized := make([]model.ScheduledTaskConfig, len(items))
	for i := range items {
		normalized[i] = items[i]
		normalized[i].Name = strings.TrimSpace(normalized[i].Name)
		normalized[i].Cron = normalizeScheduledTaskCron(normalized[i].Cron)
	}
	return normalized
}

func normalizeScheduledTaskCron(expr string) string {
	fields := strings.Fields(strings.TrimSpace(expr))
	switch len(fields) {
	case 5:
		return "0 " + strings.Join(fields, " ")
	case 6:
		return strings.Join(fields, " ")
	default:
		return strings.TrimSpace(expr)
	}
}

func validateScheduledTasks(items []model.ScheduledTaskConfig) ([]model.ScheduledTaskConfig, error) {
	normalized := normalizeScheduledTasks(items)
	seen := make(map[string]struct{}, len(normalized))

	for _, item := range normalized {
		if item.Name == "" {
			return nil, fmt.Errorf("scheduled task name is required")
		}
		if item.Cron == "" {
			return nil, fmt.Errorf("scheduled task cron is required")
		}
		if _, exists := seen[item.Name]; exists {
			return nil, fmt.Errorf("duplicate scheduled task name: %s", item.Name)
		}
		seen[item.Name] = struct{}{}
	}

	return normalized, nil
}

func normalizeWebhooks(items []model.Webhook) []model.Webhook {
	normalized := make([]model.Webhook, len(items))
	for i := range items {
		normalized[i] = items[i]
		normalized[i].Name = strings.TrimSpace(normalized[i].Name)
		normalized[i].Method = strings.ToUpper(strings.TrimSpace(normalized[i].Method))
		if normalized[i].Method == "" {
			normalized[i].Method = "POST"
		}
		if normalized[i].Headers == nil {
			normalized[i].Headers = map[string]string{}
		}
		if normalized[i].QueryParams == nil {
			normalized[i].QueryParams = map[string]string{}
		}
		if normalized[i].TimeoutSeconds <= 0 {
			normalized[i].TimeoutSeconds = 10
		}
	}
	return normalized
}

func validateWebhooks(items []model.Webhook) ([]model.Webhook, error) {
	normalized := normalizeWebhooks(items)
	seen := make(map[string]struct{}, len(normalized))

	for _, item := range normalized {
		if item.Name == "" {
			return nil, fmt.Errorf("webhook name is required")
		}
		if _, exists := seen[item.Name]; exists {
			return nil, fmt.Errorf("duplicate webhook name: %s", item.Name)
		}
		seen[item.Name] = struct{}{}
	}

	return normalized, nil
}

func normalizeEventBindings(items []model.EventBinding) []model.EventBinding {
	normalized := make([]model.EventBinding, len(items))
	for i := range items {
		normalized[i] = items[i]
		normalized[i].Event = strings.TrimSpace(normalized[i].Event)
		normalized[i].WebhookName = strings.TrimSpace(normalized[i].WebhookName)
	}
	return normalized
}

func validateEventBindings(items []model.EventBinding) ([]model.EventBinding, error) {
	normalized := normalizeEventBindings(items)
	seen := make(map[string]struct{}, len(normalized))

	for _, item := range normalized {
		if item.Event == "" {
			return nil, fmt.Errorf("event name is required")
		}
		if item.WebhookName == "" {
			return nil, fmt.Errorf("webhook name is required")
		}
		key := item.Event + "|" + item.WebhookName
		if _, exists := seen[key]; exists {
			return nil, fmt.Errorf("duplicate event binding: %s -> %s", item.Event, item.WebhookName)
		}
		seen[key] = struct{}{}
	}

	return normalized, nil
}
