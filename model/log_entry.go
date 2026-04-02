package model

import "time"

// LogEntry 日志条目数据库模型
type LogEntry struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	LogDate   string    `gorm:"type:varchar(10);index;not null" json:"log_date"`   // YYYY-MM-DD
	LogTime   string    `gorm:"type:varchar(8);not null" json:"log_time"`          // HH:mm:ss
	EventType string    `gorm:"type:varchar(100);not null" json:"event_type"`
	Detail    string    `gorm:"type:text" json:"detail"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (LogEntry) TableName() string {
	return "log_entries"
}
