package repository

import (
	"github.com/hxuanyu/lifelog/internal/model"
	"gorm.io/gorm"
)

// LogEntryQuery 日志查询参数
type LogEntryQuery struct {
	Date      string // YYYY-MM-DD
	StartDate string // 范围查询起始
	EndDate   string // 范围查询结束
	EventType string
	Keyword   string
	Page      int
	Size      int
}

// CreateLogEntry 创建日志
func CreateLogEntry(entry *model.LogEntry) error {
	return DB.Create(entry).Error
}

// GetLogEntryByID 根据 ID 获取日志
func GetLogEntryByID(id uint) (*model.LogEntry, error) {
	var entry model.LogEntry
	if err := DB.First(&entry, id).Error; err != nil {
		return nil, err
	}
	return &entry, nil
}

// UpdateLogEntry 更新日志
func UpdateLogEntry(entry *model.LogEntry) error {
	return DB.Save(entry).Error
}

// DeleteLogEntry 删除日志
func DeleteLogEntry(id uint) error {
	return DB.Delete(&model.LogEntry{}, id).Error
}

// QueryLogEntries 查询日志列表（支持筛选和分页）
func QueryLogEntries(q LogEntryQuery) ([]model.LogEntry, int64, error) {
	tx := DB.Model(&model.LogEntry{})

	tx = applyFilters(tx, q)

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 20
	}

	var entries []model.LogEntry
	err := tx.Order("log_date DESC, log_time DESC").
		Offset((q.Page - 1) * q.Size).
		Limit(q.Size).
		Find(&entries).Error
	return entries, total, err
}

// GetTimelineEntries 获取某天的时间轴（按 log_time 升序）
func GetTimelineEntries(date string) ([]model.LogEntry, error) {
	var entries []model.LogEntry
	err := DB.Where("log_date = ?", date).
		Order("log_time ASC").
		Find(&entries).Error
	return entries, err
}

// GetEntriesByDateRange 获取日期范围内的日志（按日期和时间升序）
func GetEntriesByDateRange(startDate, endDate string) ([]model.LogEntry, error) {
	var entries []model.LogEntry
	err := DB.Where("log_date >= ? AND log_date <= ?", startDate, endDate).
		Order("log_date ASC, log_time ASC").
		Find(&entries).Error
	return entries, err
}

// GetLastEntryBefore 获取指定日期之前最近的一条日志（用于跨天衔接）
func GetLastEntryBefore(date string) (*model.LogEntry, error) {
	var entry model.LogEntry
	err := DB.Where("log_date < ?", date).
		Order("log_date DESC, log_time DESC").
		First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// GetFirstEntryAfter 获取指定日期之后最近的一条日志（用于跨天衔接）
func GetFirstEntryAfter(date string) (*model.LogEntry, error) {
	var entry model.LogEntry
	err := DB.Where("log_date > ?", date).
		Order("log_date ASC, log_time ASC").
		First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// GetDistinctEventTypes 获取所有不重复的事项类型
func GetDistinctEventTypes() ([]string, error) {
	var types []string
	err := DB.Model(&model.LogEntry{}).Distinct("event_type").Order("event_type").Pluck("event_type", &types).Error
	return types, err
}

func applyFilters(tx *gorm.DB, q LogEntryQuery) *gorm.DB {
	if q.Date != "" {
		tx = tx.Where("log_date = ?", q.Date)
	}
	if q.StartDate != "" {
		tx = tx.Where("log_date >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		tx = tx.Where("log_date <= ?", q.EndDate)
	}
	if q.EventType != "" {
		tx = tx.Where("event_type = ?", q.EventType)
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("event_type LIKE ? OR detail LIKE ?", like, like)
	}
	return tx
}
