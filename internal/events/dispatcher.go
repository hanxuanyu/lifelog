package events

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
)

// Fire 异步触发事件，查找绑定的 webhook 并执行
func Fire(eventName string, data map[string]string) {
	bindings := config.GetEventBindings()
	for _, b := range bindings {
		if b.Event == eventName && b.Enabled && b.WebhookName != "" {
			wh := config.GetWebhookByName(b.WebhookName)
			if wh == nil {
				slog.Warn("事件绑定的 webhook 不存在", "event", eventName, "webhook", b.WebhookName)
				continue
			}
			whCopy := *wh
			go func(eventName string) {
				if err := ExecuteWebhook(whCopy, data); err != nil {
					slog.Error("webhook 执行失败", "event", eventName, "webhook", whCopy.Name, "error", err)
				} else {
					slog.Info("webhook 执行成功", "event", eventName, "webhook", whCopy.Name)
				}
			}(eventName)
		}
	}
}

// ExecuteWebhook 同步执行 webhook（用于测试和实际调用）
func ExecuteWebhook(wh model.Webhook, data map[string]string) error {
	url := replacePlaceholders(wh.URL, data)
	body := replacePlaceholders(wh.Body, data)

	method := wh.Method
	if method == "" {
		method = "POST"
	}

	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("构建请求失败: %w", err)
	}

	// 替换 headers
	for k, v := range wh.Headers {
		req.Header.Set(k, replacePlaceholders(v, data))
	}

	// 替换 query params
	q := req.URL.Query()
	for k, v := range wh.QueryParams {
		q.Set(k, replacePlaceholders(v, data))
	}
	req.URL.RawQuery = q.Encode()

	timeout := time.Duration(wh.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("响应状态码 %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// replacePlaceholders 将 {{key}} 替换为 data 中对应的值
func replacePlaceholders(tpl string, data map[string]string) string {
	for k, v := range data {
		tpl = strings.ReplaceAll(tpl, "{{"+k+"}}", v)
	}
	return tpl
}

// GetSampleData 根据事件名返回示例数据（用于测试 webhook）
func GetSampleData(eventName string) map[string]string {
	for _, def := range Registry {
		if def.Name == eventName {
			data := make(map[string]string, len(def.Variables))
			for _, v := range def.Variables {
				data[v.Key] = fmt.Sprintf("<%s_sample>", v.Key)
			}
			return data
		}
	}
	return map[string]string{}
}
