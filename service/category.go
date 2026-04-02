package service

import (
	"regexp"
	"sync"

	"github.com/hxuanyu/lifelog/config"
	"github.com/hxuanyu/lifelog/model"
)

var (
	regexCache   = make(map[string]*regexp.Regexp)
	regexCacheMu sync.RWMutex
)

// MatchCategory 根据当前配置匹配 event_type 到大类名称
func MatchCategory(eventType string) string {
	categories := config.GetCategories()
	for _, cat := range categories {
		for _, rule := range cat.Rules {
			switch rule.Type {
			case "fixed":
				if eventType == rule.Pattern {
					return cat.Name
				}
			case "regex":
				if matchRegex(rule.Pattern, eventType) {
					return cat.Name
				}
			}
		}
	}
	return "未分类"
}

// MatchCategories 批量匹配
func MatchCategories(entries []model.LogEntry) []model.LogEntryResponse {
	result := make([]model.LogEntryResponse, len(entries))
	for i, e := range entries {
		result[i] = model.LogEntryResponse{
			ID:        e.ID,
			LogDate:   e.LogDate,
			LogTime:   e.LogTime,
			EventType: e.EventType,
			Detail:    e.Detail,
			Category:  MatchCategory(e.EventType),
		}
	}
	return result
}

// ToResponse 单条日志转响应 DTO
func ToResponse(e *model.LogEntry) model.LogEntryResponse {
	return model.LogEntryResponse{
		ID:        e.ID,
		LogDate:   e.LogDate,
		LogTime:   e.LogTime,
		EventType: e.EventType,
		Detail:    e.Detail,
		Category:  MatchCategory(e.EventType),
	}
}

func matchRegex(pattern, s string) bool {
	re := getCompiledRegex(pattern)
	if re == nil {
		return false
	}
	return re.MatchString(s)
}

func getCompiledRegex(pattern string) *regexp.Regexp {
	regexCacheMu.RLock()
	re, ok := regexCache[pattern]
	regexCacheMu.RUnlock()
	if ok {
		return re
	}

	regexCacheMu.Lock()
	defer regexCacheMu.Unlock()
	// double check
	if re, ok := regexCache[pattern]; ok {
		return re
	}
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil
	}
	regexCache[pattern] = compiled
	return compiled
}
