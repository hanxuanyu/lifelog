package service

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hxuanyu/lifelog/internal/config"
	"golang.org/x/crypto/bcrypt"
)

// Login 验证密码并返回 JWT
func Login(password string) (string, error) {
	hash := config.GetPasswordHash()
	if hash == "" {
		return "", fmt.Errorf("尚未设置密码，请先设置密码")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", fmt.Errorf("密码错误")
	}

	return generateToken()
}

// SetPassword 设置/修改密码
func SetPassword(oldPassword, newPassword string) error {
	hash := config.GetPasswordHash()

	// 已有密码时需验证旧密码
	if hash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)); err != nil {
			return fmt.Errorf("旧密码错误")
		}
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	return config.SetPasswordHash(string(newHash))
}

// SetPasswordAndLogin 设置/修改密码并返回新 token
func SetPasswordAndLogin(oldPassword, newPassword string) (string, error) {
	if err := SetPassword(oldPassword, newPassword); err != nil {
		return "", err
	}
	return generateToken()
}

// IsPasswordSet 是否已设置密码
func IsPasswordSet() bool {
	return config.GetPasswordHash() != ""
}

// ValidateToken 验证 JWT token
func ValidateToken(tokenStr string) error {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(config.GetJWTSecret()), nil
	})
	if err != nil {
		return err
	}
	if !token.Valid {
		return fmt.Errorf("无效的 token")
	}
	return nil
}

func generateToken() (string, error) {
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Duration(config.GetJWTExpireHours()) * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.GetJWTSecret()))
}
