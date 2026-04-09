package events

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
)

// WebhookTestResult 测试 webhook 的响应结果
type WebhookTestResult struct {
	StatusCode int    `json:"status_code"`
	Body       string `json:"body"`
}

// ExecuteWebhookWithResponse 同步执行 webhook 并返回响应详情
func ExecuteWebhookWithResponse(wh model.Webhook, data map[string]string) (*WebhookTestResult, error) {
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
		return nil, fmt.Errorf("构建请求失败: %w", err)
	}

	for k, v := range wh.Headers {
		req.Header.Set(k, replacePlaceholders(v, data))
	}

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
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	result := &WebhookTestResult{
		StatusCode: resp.StatusCode,
		Body:       string(respBody),
	}

	if resp.StatusCode >= 400 {
		return result, fmt.Errorf("响应状态码 %d", resp.StatusCode)
	}
	return result, nil
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
