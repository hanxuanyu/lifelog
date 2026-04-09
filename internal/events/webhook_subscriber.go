package events

import (
	"log/slog"

	"github.com/hxuanyu/lifelog/internal/config"
)

// WebhookSubscriber 将事件分发到绑定的 webhook
type WebhookSubscriber struct{}

func (w *WebhookSubscriber) Name() string { return "webhook" }

func (w *WebhookSubscriber) Handle(eventName string, data map[string]string) {
	bindings := config.GetEventBindings()
	for _, b := range bindings {
		if b.Event == eventName && b.Enabled && b.WebhookName != "" {
			wh := config.GetWebhookByName(b.WebhookName)
			if wh == nil {
				slog.Warn("事件绑定的 webhook 不存在", "event", eventName, "webhook", b.WebhookName)
				continue
			}
			whCopy := *wh
			if err := ExecuteWebhook(whCopy, data); err != nil {
				slog.Error("webhook 执行失败", "event", eventName, "webhook", whCopy.Name, "error", err)
			} else {
				slog.Info("webhook 执行成功", "event", eventName, "webhook", whCopy.Name)
			}
		}
	}
}
