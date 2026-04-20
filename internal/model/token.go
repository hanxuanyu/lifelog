package model

import "time"

// Token 令牌数据库模型
type Token struct {
	ID         string     `gorm:"primarykey;type:varchar(36)" json:"id"`
	Type       string     `gorm:"type:varchar(10);not null;index" json:"type"`
	Name       string     `gorm:"type:varchar(100)" json:"name"`
	Status     string     `gorm:"type:varchar(10);not null;default:'active';index" json:"status"`
	IP         string     `gorm:"type:varchar(45)" json:"ip"`
	UserAgent  string     `gorm:"type:text" json:"user_agent"`
	ExpiresAt  *time.Time `json:"expires_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
	CreatedAt  time.Time  `json:"created_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
}

func (Token) TableName() string {
	return "tokens"
}
