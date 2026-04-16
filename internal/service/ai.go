package service

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

func buildAPIMessages(systemPrompt string, messages []model.AIChatMessage) []map[string]string {
	apiMessages := []map[string]string{
		{"role": "system", "content": systemPrompt},
	}
	for _, m := range messages {
		apiMessages = append(apiMessages, map[string]string{"role": m.Role, "content": m.Content})
	}
	return apiMessages
}

// BuildLogContext 根据日期范围构建日志上下文文本，可选按分类筛选
func BuildLogContext(startDate, endDate string, categories []string) (string, error) {
	entries, err := repository.GetEntriesByDateRange(startDate, endDate)
	if err != nil {
		slog.Error("构建日志上下文失败", "error", err, "start", startDate, "end", endDate)
		return "", fmt.Errorf("查询日志失败: %w", err)
	}
	slog.Debug("构建日志上下文", "start", startDate, "end", endDate, "entries", len(entries), "categories_filter", len(categories))
	if len(entries) == 0 {
		return fmt.Sprintf("在 %s 至 %s 期间没有任何日志记录。", startDate, endDate), nil
	}

	// 构建分类过滤集合
	catFilter := make(map[string]bool, len(categories))
	for _, c := range categories {
		catFilter[c] = true
	}
	filterEnabled := len(catFilter) > 0

	var b strings.Builder
	b.WriteString(fmt.Sprintf("以下是用户在 %s 至 %s 期间的活动日志：\n\n", startDate, endDate))

	currentDate := ""
	count := 0
	for _, e := range entries {
		cat := MatchCategory(e.EventType)
		if filterEnabled && !catFilter[cat] {
			continue
		}
		if e.LogDate != currentDate {
			currentDate = e.LogDate
			b.WriteString(fmt.Sprintf("## %s\n", currentDate))
		}
		line := fmt.Sprintf("- %s %s", e.LogTime[:5], e.EventType)
		if cat != "" {
			line += fmt.Sprintf(" [%s]", cat)
		}
		if e.Detail != "" {
			line += fmt.Sprintf(" — %s", e.Detail)
		}
		b.WriteString(line + "\n")
		count++
	}

	if filterEnabled && count == 0 {
		return fmt.Sprintf("在 %s 至 %s 期间，所选分类下没有日志记录。", startDate, endDate), nil
	}
	return b.String(), nil
}

// StreamChat 调用 AI 提供商的 OpenAI 兼容接口进行流式对话
func StreamChat(provider model.AIProvider, systemPrompt string, messages []model.AIChatMessage, writer io.Writer, flusher http.Flusher) error {
	body, _ := json.Marshal(map[string]any{
		"model":    provider.Model,
		"messages": buildAPIMessages(systemPrompt, messages),
		"stream":   true,
	})

	endpoint := strings.TrimRight(provider.Endpoint, "/") + "/chat/completions"
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	if provider.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+provider.APIKey)
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("AI流式请求失败", "endpoint", endpoint, "error", err)
		return fmt.Errorf("请求AI服务失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI服务返回错误 (%d): %s", resp.StatusCode, string(respBody))
	}

	reader := bufio.NewReader(resp.Body)
	eventLines := make([]string, 0, 4)
	for {
		line, readErr := reader.ReadString('\n')
		line = strings.TrimRight(line, "\r\n")

		if line == "" {
			done, err := forwardStreamEvent(eventLines, writer, flusher)
			if err != nil {
				return err
			}
			if done {
				return nil
			}
			eventLines = eventLines[:0]
		} else {
			eventLines = append(eventLines, line)
		}

		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return readErr
		}
	}

	done, err := forwardStreamEvent(eventLines, writer, flusher)
	if err != nil {
		return err
	}
	if !done {
		if _, err := fmt.Fprint(writer, "data: [DONE]\n\n"); err != nil {
			return err
		}
		if flusher != nil {
			flusher.Flush()
		}
	}

	return nil
}

func forwardStreamEvent(lines []string, writer io.Writer, flusher http.Flusher) (bool, error) {
	if len(lines) == 0 {
		return false, nil
	}

	payloadLines := make([]string, 0, len(lines))
	for _, line := range lines {
		switch {
		case strings.HasPrefix(line, "data:"):
			payloadLines = append(payloadLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		case strings.HasPrefix(line, ":"):
			continue
		default:
			payloadLines = append(payloadLines, strings.TrimSpace(line))
		}
	}

	payload := strings.TrimSpace(strings.Join(payloadLines, "\n"))
	if payload == "" {
		return false, nil
	}
	if payload == "[DONE]" {
		if _, err := fmt.Fprint(writer, "data: [DONE]\n\n"); err != nil {
			return false, err
		}
		if flusher != nil {
			flusher.Flush()
		}
		return true, nil
	}

	content, reasoning := extractStreamContent(payload)
	if content == "" && reasoning == "" {
		return false, nil
	}

	ssePayload := make(map[string]string)
	if content != "" {
		ssePayload["content"] = content
	}
	if reasoning != "" {
		ssePayload["reasoning"] = reasoning
	}
	sseData, _ := json.Marshal(ssePayload)
	if _, err := fmt.Fprintf(writer, "data: %s\n\n", sseData); err != nil {
		return false, err
	}
	if flusher != nil {
		flusher.Flush()
	}

	return false, nil
}

func extractStreamContent(payload string) (content string, reasoning string) {
	var chunk struct {
		Choices []struct {
			Delta struct {
				Content          any `json:"content"`
				ReasoningContent any `json:"reasoning_content"`
			} `json:"delta"`
			Message struct {
				Content any `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
		return "", ""
	}
	if len(chunk.Choices) == 0 {
		return "", ""
	}
	content = extractMessageContent(chunk.Choices[0].Delta.Content, false)
	if content == "" {
		content = extractMessageContent(chunk.Choices[0].Message.Content, false)
	}
	reasoning = extractMessageContent(chunk.Choices[0].Delta.ReasoningContent, false)
	return content, reasoning
}

// ChatCompletion 调用 AI 提供商的 OpenAI 兼容接口进行非流式对话
func ChatCompletion(provider model.AIProvider, systemPrompt string, messages []model.AIChatMessage) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"model":    provider.Model,
		"messages": buildAPIMessages(systemPrompt, messages),
		"stream":   false,
	})

	endpoint := strings.TrimRight(provider.Endpoint, "/") + "/chat/completions"
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if provider.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+provider.APIKey)
	}

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("AI非流式请求失败", "endpoint", endpoint, "error", err)
		return "", fmt.Errorf("请求AI服务失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI服务返回错误 (%d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content any `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析AI响应失败: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI响应为空")
	}

	content := extractMessageContent(result.Choices[0].Message.Content, true)
	if content == "" {
		return "", fmt.Errorf("AI响应内容为空")
	}
	return content, nil
}

func extractMessageContent(content any, trim bool) string {
	switch v := content.(type) {
	case string:
		if trim {
			return strings.TrimSpace(v)
		}
		return v
	case []any:
		var parts []string
		for _, item := range v {
			segment, ok := item.(map[string]any)
			if !ok {
				continue
			}
			switch text := segment["text"].(type) {
			case string:
				parts = append(parts, text)
			case map[string]any:
				if value, ok := text["value"].(string); ok {
					parts = append(parts, value)
				}
			}
		}
		joined := strings.Join(parts, "\n")
		if trim {
			return strings.TrimSpace(joined)
		}
		return joined
	default:
		return ""
	}
}

// TestProvider 测试 AI 提供商连接
func TestProvider(provider model.AIProvider) error {
	slog.Debug("测试AI提供商连接", "name", provider.Name, "endpoint", provider.Endpoint, "model", provider.Model)
	body, _ := json.Marshal(map[string]any{
		"model":      provider.Model,
		"messages":   []map[string]string{{"role": "user", "content": "Hi, reply with ok."}},
		"max_tokens": 10,
	})

	endpoint := strings.TrimRight(provider.Endpoint, "/") + "/chat/completions"
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if provider.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+provider.APIKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("连接失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("服务返回错误 (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// FetchModels 从 AI 提供商获取可用模型列表
func FetchModels(endpoint, apiKey string) ([]string, error) {
	slog.Debug("获取模型列表", "endpoint", endpoint)
	url := strings.TrimRight(endpoint, "/") + "/models"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("服务返回错误 (%d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	models := make([]string, 0, len(result.Data))
	for _, m := range result.Data {
		if m.ID != "" {
			models = append(models, m.ID)
		}
	}
	return models, nil
}
