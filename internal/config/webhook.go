package config

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/spf13/viper"
)

var (
	webhooks      []model.Webhook
	eventBindings []model.EventBinding
)

func loadWebhooks() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.Webhook
	if err := viper.UnmarshalKey("webhooks", &items); err != nil {
		slog.Error("failed to parse webhook config", "error", err)
		return
	}

	for i := range items {
		items[i].Name = strings.TrimSpace(items[i].Name)
		items[i].Method = strings.ToUpper(strings.TrimSpace(items[i].Method))
		if items[i].Method == "" {
			items[i].Method = "POST"
		}
		if items[i].Headers == nil {
			items[i].Headers = map[string]string{}
		}
		if items[i].QueryParams == nil {
			items[i].QueryParams = map[string]string{}
		}
		if items[i].TimeoutSeconds <= 0 {
			items[i].TimeoutSeconds = 10
		}
	}

	webhooks = items
	slog.Info("webhook config loaded", "count", len(webhooks))
}

func loadEventBindings() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.EventBinding
	if err := viper.UnmarshalKey("event_bindings", &items); err != nil {
		slog.Error("failed to parse event bindings", "error", err)
		return
	}

	for i := range items {
		items[i].Event = strings.TrimSpace(items[i].Event)
		items[i].WebhookName = strings.TrimSpace(items[i].WebhookName)
	}

	eventBindings = items
	slog.Info("event bindings loaded", "count", len(eventBindings))
}

// GetWebhooks 获取所有 webhook 配置
func GetWebhooks() []model.Webhook {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]model.Webhook, len(webhooks))
	copy(result, webhooks)
	return result
}

// GetWebhookByName 根据名称获取 webhook
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

// SetWebhooks 保存 webhook 配置
func SetWebhooks(items []model.Webhook) error {
	seen := make(map[string]struct{}, len(items))
	for i := range items {
		items[i].Name = strings.TrimSpace(items[i].Name)
		if items[i].Name == "" {
			return fmt.Errorf("webhook name is required")
		}
		if _, exists := seen[items[i].Name]; exists {
			return fmt.Errorf("duplicate webhook name: %s", items[i].Name)
		}
		seen[items[i].Name] = struct{}{}
		items[i].Method = strings.ToUpper(strings.TrimSpace(items[i].Method))
		if items[i].Method == "" {
			items[i].Method = "POST"
		}
		if items[i].Headers == nil {
			items[i].Headers = map[string]string{}
		}
		if items[i].QueryParams == nil {
			items[i].QueryParams = map[string]string{}
		}
		if items[i].TimeoutSeconds <= 0 {
			items[i].TimeoutSeconds = 10
		}
	}

	viper.Set("webhooks", items)
	if err := viper.WriteConfig(); err != nil {
		return err
	}
	loadWebhooks()
	return nil
}

// GetEventBindings 获取所有事件绑定
func GetEventBindings() []model.EventBinding {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]model.EventBinding, len(eventBindings))
	copy(result, eventBindings)
	return result
}

// GetEventBinding 根据事件名获取绑定
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

// SetEventBindings 保存事件绑定配置
func SetEventBindings(items []model.EventBinding) error {
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		eventName := strings.TrimSpace(item.Event)
		if eventName == "" {
			return fmt.Errorf("event name is required")
		}
		if _, exists := seen[eventName]; exists {
			return fmt.Errorf("duplicate event binding: %s", eventName)
		}
		seen[eventName] = struct{}{}
	}

	viper.Set("event_bindings", items)
	if err := viper.WriteConfig(); err != nil {
		return err
	}
	loadEventBindings()
	return nil
}
