package service

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

// BuildLogContext 根据日期范围构建日志上下文文本，可选按分类筛选
func BuildLogContext(startDate, endDate string, categories []string) (string, error) {
	entries, err := repository.GetEntriesByDateRange(startDate, endDate)
	if err != nil {
		return "", fmt.Errorf("查询日志失败: %w", err)
	}
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
	apiMessages := []map[string]string{
		{"role": "system", "content": systemPrompt},
	}
	for _, m := range messages {
		apiMessages = append(apiMessages, map[string]string{"role": m.Role, "content": m.Content})
	}

	body, _ := json.Marshal(map[string]any{
		"model":    provider.Model,
		"messages": apiMessages,
		"stream":   true,
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

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("请求AI服务失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI服务返回错误 (%d): %s", resp.StatusCode, string(respBody))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			fmt.Fprintf(writer, "data: [DONE]\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			sseData, _ := json.Marshal(map[string]string{"content": chunk.Choices[0].Delta.Content})
			fmt.Fprintf(writer, "data: %s\n\n", sseData)
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
	return scanner.Err()
}

// TestProvider 测试 AI 提供商连接
func TestProvider(provider model.AIProvider) error {
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
