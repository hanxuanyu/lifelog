package config

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/hxuanyu/lifelog/internal/model"
)

var (
	customPrompts []model.Prompt
)

var builtinPrompts = []model.Prompt{
	{
		Name: "scheduled_report",
		Description: "定时报告默认提示词",
		Content: `你是一个生活日志报告助手，需要根据结构化统计和原始日志生成可直接推送的中文 Markdown 报告。

要求：
1. 只基于提供的数据进行总结，不虚构用户未记录的事实。
2. 开头先给出一句整体概览。
3. 再用 2 到 4 个简短小节或要点，指出时间投入重点、节奏特征和可观察到的问题。
4. 语气客观、简洁、可读，适合消息通知、日报、周报或月报推送。
5. 如果记录较少，要明确指出样本有限。`,
		Builtin: true,
	},
	{
		Name: "ai_chat_default",
		Description: "AI 对话默认提示词",
		Content: `你是一个生活日志分析助手。用户会提供一段时间内的活动日志数据，请根据用户的问题对这些数据进行分析和总结。
请用中文回答，使用 Markdown 格式输出。`,
		Builtin: true,
	},
}

// PLACEHOLDER_PROMPTS_FUNCS

type promptsFileConfig struct {
	Prompts []model.Prompt `mapstructure:"prompts" yaml:"prompts"`
}

func defaultPromptsConfig() promptsFileConfig {
	return promptsFileConfig{
		Prompts: []model.Prompt{},
	}
}

func loadPrompts() {
	mu.Lock()
	defer mu.Unlock()

	var items []model.Prompt
	if err := promptsViper.UnmarshalKey("prompts", &items); err != nil {
		slog.Error("failed to parse prompts config", "error", err)
		return
	}

	customPrompts = normalizePrompts(items)
	slog.Info("prompts config loaded", "count", len(customPrompts))
}

func normalizePrompts(items []model.Prompt) []model.Prompt {
	normalized := make([]model.Prompt, len(items))
	for i := range items {
		normalized[i] = items[i]
		normalized[i].Name = strings.TrimSpace(normalized[i].Name)
		normalized[i].Content = strings.TrimSpace(normalized[i].Content)
		normalized[i].Description = strings.TrimSpace(normalized[i].Description)
		normalized[i].Builtin = false
	}
	return normalized
}

// GetAllPrompts returns all prompts (builtin + custom).
func GetAllPrompts() []model.Prompt {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.Prompt, 0, len(builtinPrompts)+len(customPrompts))
	result = append(result, builtinPrompts...)
	result = append(result, customPrompts...)
	return result
}

// GetCustomPrompts returns only user-defined prompts.
func GetCustomPrompts() []model.Prompt {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.Prompt, len(customPrompts))
	copy(result, customPrompts)
	return result
}

// GetPromptByName returns a prompt by name, searching builtins first.
func GetPromptByName(name string) *model.Prompt {
	mu.RLock()
	defer mu.RUnlock()

	for _, p := range builtinPrompts {
		if p.Name == name {
			cp := p
			return &cp
		}
	}
	for _, p := range customPrompts {
		if p.Name == name {
			cp := p
			return &cp
		}
	}
	return nil
}

// AddCustomPrompt adds a new custom prompt. Returns error if name conflicts with builtin or existing custom.
func AddCustomPrompt(p model.Prompt) error {
	p.Name = strings.TrimSpace(p.Name)
	p.Content = strings.TrimSpace(p.Content)
	p.Description = strings.TrimSpace(p.Description)

	if p.Name == "" {
		return fmt.Errorf("prompt name is required")
	}
	if p.Content == "" {
		return fmt.Errorf("prompt content is required")
	}

	for _, b := range builtinPrompts {
		if b.Name == p.Name {
			return fmt.Errorf("prompt name conflicts with builtin: %s", p.Name)
		}
	}

	mu.Lock()
	defer mu.Unlock()

	for _, c := range customPrompts {
		if c.Name == p.Name {
			return fmt.Errorf("duplicate prompt name: %s", p.Name)
		}
	}

	p.Builtin = false
	next := append(append([]model.Prompt{}, customPrompts...), p)
	promptsViper.Set("prompts", next)
	if err := promptsViper.WriteConfig(); err != nil {
		return err
	}
	customPrompts = next
	return nil
}

// UpdateCustomPrompt updates an existing custom prompt by name.
func UpdateCustomPrompt(name string, p model.Prompt) error {
	name = strings.TrimSpace(name)
	p.Content = strings.TrimSpace(p.Content)
	p.Description = strings.TrimSpace(p.Description)

	for _, b := range builtinPrompts {
		if b.Name == name {
			return fmt.Errorf("cannot modify builtin prompt: %s", name)
		}
	}

	mu.Lock()
	defer mu.Unlock()

	found := false
	next := make([]model.Prompt, len(customPrompts))
	for i, c := range customPrompts {
		if c.Name == name {
			next[i] = model.Prompt{
				Name:        name,
				Content:     p.Content,
				Description: p.Description,
			}
			found = true
		} else {
			next[i] = c
		}
	}
	if !found {
		return fmt.Errorf("prompt not found: %s", name)
	}

	promptsViper.Set("prompts", next)
	if err := promptsViper.WriteConfig(); err != nil {
		return err
	}
	customPrompts = next
	return nil
}

// DeleteCustomPrompt removes a custom prompt by name.
func DeleteCustomPrompt(name string) error {
	name = strings.TrimSpace(name)

	for _, b := range builtinPrompts {
		if b.Name == name {
			return fmt.Errorf("cannot delete builtin prompt: %s", name)
		}
	}

	mu.Lock()
	defer mu.Unlock()

	next := make([]model.Prompt, 0, len(customPrompts))
	found := false
	for _, c := range customPrompts {
		if c.Name == name {
			found = true
			continue
		}
		next = append(next, c)
	}
	if !found {
		return fmt.Errorf("prompt not found: %s", name)
	}

	promptsViper.Set("prompts", next)
	if err := promptsViper.WriteConfig(); err != nil {
		return err
	}
	customPrompts = next
	return nil
}

// SetCustomPrompts replaces all custom prompts (used by import).
func SetCustomPrompts(items []model.Prompt) error {
	normalized := normalizePrompts(items)
	promptsViper.Set("prompts", normalized)
	if err := promptsViper.WriteConfig(); err != nil {
		return err
	}
	mu.Lock()
	customPrompts = normalized
	mu.Unlock()
	return nil
}

