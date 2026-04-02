package service

import (
	"fmt"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/util"
)

// CreateLogEntry 新增日志条目
func CreateLogEntry(req model.LogEntryRequest) (*model.LogEntry, error) {
	logTime, err := util.ParseTime(req.LogTime)
	if err != nil {
		return nil, fmt.Errorf("时间格式错误: %w", err)
	}

	logDate := req.LogDate
	if logDate == "" {
		logDate = time.Now().Format("2006-01-02")
	}

	entry := &model.LogEntry{
		LogDate:   logDate,
		LogTime:   logTime,
		EventType: req.EventType,
		Detail:    req.Detail,
	}

	if err := repository.CreateLogEntry(entry); err != nil {
		return nil, fmt.Errorf("保存日志失败: %w", err)
	}
	return entry, nil
}

// GetLogEntry 获取单条日志
func GetLogEntry(id uint) (*model.LogEntryResponse, error) {
	entry, err := repository.GetLogEntryByID(id)
	if err != nil {
		return nil, err
	}
	resp := ToResponse(entry)
	return &resp, nil
}

// UpdateLogEntry 修改日志
func UpdateLogEntry(id uint, req model.LogEntryRequest) (*model.LogEntry, error) {
	entry, err := repository.GetLogEntryByID(id)
	if err != nil {
		return nil, err
	}

	if req.LogTime != "" {
		logTime, err := util.ParseTime(req.LogTime)
		if err != nil {
			return nil, fmt.Errorf("时间格式错误: %w", err)
		}
		entry.LogTime = logTime
	}
	if req.LogDate != "" {
		entry.LogDate = req.LogDate
	}
	if req.EventType != "" {
		entry.EventType = req.EventType
	}
	entry.Detail = req.Detail

	if err := repository.UpdateLogEntry(entry); err != nil {
		return nil, fmt.Errorf("更新日志失败: %w", err)
	}
	return entry, nil
}

// DeleteLogEntry 删除日志
func DeleteLogEntry(id uint) error {
	return repository.DeleteLogEntry(id)
}

// QueryLogEntries 查询日志列表（支持筛选、分页，结果含动态大类匹配）
func QueryLogEntries(q repository.LogEntryQuery, category string) ([]model.LogEntryResponse, int64, error) {
	entries, total, err := repository.QueryLogEntries(q)
	if err != nil {
		return nil, 0, err
	}

	responses := MatchCategories(entries)

	// 按大类筛选（动态过滤）
	if category != "" {
		filtered := make([]model.LogEntryResponse, 0)
		for _, r := range responses {
			if r.Category == category {
				filtered = append(filtered, r)
			}
		}
		return filtered, int64(len(filtered)), nil
	}

	return responses, total, nil
}

// GetTimeline 获取某天时间轴
func GetTimeline(date string) ([]model.LogEntryResponse, error) {
	entries, err := repository.GetTimelineEntries(date)
	if err != nil {
		return nil, err
	}
	return MatchCategories(entries), nil
}
