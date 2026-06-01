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
	Marker    *bool
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
	found, err := findFirst(DB.Where("log_date < ?", date).
		Order("log_date DESC, log_time DESC").
		Limit(1), &entry)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return &entry, nil
}

// GetFirstEntryAfter 获取指定日期之后最近的一条日志（用于跨天衔接）
func GetFirstEntryAfter(date string) (*model.LogEntry, error) {
	var entry model.LogEntry
	found, err := findFirst(DB.Where("log_date > ?", date).
		Order("log_date ASC, log_time ASC").
		Limit(1), &entry)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return &entry, nil
}

// GetLatestEntry 获取最新一条日志（按日期+时间倒序）
func GetLatestEntry() (*model.LogEntry, error) {
	var entry model.LogEntry
	err := DB.Order("log_date DESC, log_time DESC").First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// GetDistinctEventTypes 获取所有不重复的事项类型
func GetDistinctEventTypes() ([]string, error) {
	var types []string
	err := DB.Model(&model.LogEntry{}).
		Where("event_type <> ''").
		Distinct("event_type").
		Order("event_type").
		Pluck("event_type", &types).Error
	return types, err
}

// GetSuggestionEntries returns historical concrete entries that can be used for inference.
func GetSuggestionEntries(startDate, targetDate, targetTime string, limit int) ([]model.LogEntry, error) {
	if limit <= 0 {
		limit = 500
	}

	var entries []model.LogEntry
	err := DB.Where("log_date >= ? AND event_type <> '' AND time_point_mode <> ?", startDate, "mark").
		Where("log_date < ? OR (log_date = ? AND log_time <= ?)", targetDate, targetDate, targetTime).
		Order("log_date DESC, log_time DESC").
		Limit(limit).
		Find(&entries).Error
	return entries, err
}

// GetStaleMarkers returns temporary markers older than the provided cutoff time.
func GetStaleMarkers(cutoffDate, cutoffTime string, limit int) ([]model.LogEntry, error) {
	if limit <= 0 {
		limit = 50
	}

	var entries []model.LogEntry
	err := DB.Where("time_point_mode = ? AND event_type = '' AND detail = ''", "mark").
		Where("log_date < ? OR (log_date = ? AND log_time <= ?)", cutoffDate, cutoffDate, cutoffTime).
		Order("log_date ASC, log_time ASC").
		Limit(limit).
		Find(&entries).Error
	return entries, err
}

// GetAdjacentEntries 获取某条日志前后相邻的原始日志记录
func GetAdjacentEntries(entry model.LogEntry) (*model.LogEntry, *model.LogEntry, error) {
	var prev model.LogEntry
	prevFound, prevErr := findFirst(DB.
		Where(
			"log_date < ? OR (log_date = ? AND log_time < ?) OR (log_date = ? AND log_time = ? AND id < ?)",
			entry.LogDate, entry.LogDate, entry.LogTime, entry.LogDate, entry.LogTime, entry.ID,
		).
		Order("log_date DESC, log_time DESC, id DESC").
		Limit(1), &prev)
	if prevErr != nil {
		return nil, nil, prevErr
	}

	var next model.LogEntry
	nextFound, nextErr := findFirst(DB.
		Where(
			"log_date > ? OR (log_date = ? AND log_time > ?) OR (log_date = ? AND log_time = ? AND id > ?)",
			entry.LogDate, entry.LogDate, entry.LogTime, entry.LogDate, entry.LogTime, entry.ID,
		).
		Order("log_date ASC, log_time ASC, id ASC").
		Limit(1), &next)
	if nextErr != nil {
		return nil, nil, nextErr
	}

	var prevPtr *model.LogEntry
	if prevFound {
		prevPtr = &prev
	}

	var nextPtr *model.LogEntry
	if nextFound {
		nextPtr = &next
	}

	return prevPtr, nextPtr, nil
}

func findFirst(tx *gorm.DB, dest interface{}) (bool, error) {
	result := tx.Find(dest)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
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
	if q.Marker != nil {
		if *q.Marker {
			tx = tx.Where("time_point_mode = ? AND event_type = '' AND detail = ''", "mark")
		} else {
			tx = tx.Where("NOT (time_point_mode = ? AND event_type = '' AND detail = '')", "mark")
		}
	}
	return tx
}
