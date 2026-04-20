package repository

import (
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
)

func CreateToken(token *model.Token) error {
	return DB.Create(token).Error
}

func GetTokenByID(id string) (*model.Token, error) {
	var token model.Token
	err := DB.Where("id = ?", id).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func GetAllTokens() ([]model.Token, error) {
	var tokens []model.Token
	err := DB.Where("status = ?", "active").Order("last_used_at DESC, created_at DESC").Find(&tokens).Error
	return tokens, err
}

func UpdateLastUsedAt(id string, t time.Time) error {
	return DB.Model(&model.Token{}).Where("id = ? AND status = ?", id, "active").Update("last_used_at", t).Error
}

func RevokeToken(id string) error {
	now := time.Now()
	return DB.Model(&model.Token{}).Where("id = ? AND status = ?", id, "active").Updates(map[string]interface{}{
		"status":     "revoked",
		"revoked_at": &now,
	}).Error
}

func RevokeAllExcept(currentID string) error {
	now := time.Now()
	return DB.Model(&model.Token{}).Where("id != ? AND status = ?", currentID, "active").Updates(map[string]interface{}{
		"status":     "revoked",
		"revoked_at": &now,
	}).Error
}

func CleanupExpiredTokens() {
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	DB.Where("status = ? AND revoked_at < ?", "revoked", thirtyDaysAgo).Delete(&model.Token{})
	DB.Where("status = ? AND expires_at IS NOT NULL AND expires_at < ?", "active", sevenDaysAgo).Delete(&model.Token{})
}
