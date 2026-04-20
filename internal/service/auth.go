package service

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// Login 验证密码并返回 JWT
func Login(password, ip, userAgent string) (string, error) {
	hash := config.GetPasswordHash()
	if hash == "" {
		slog.Warn("登录失败: 尚未设置密码")
		return "", fmt.Errorf("尚未设置密码，请先设置密码")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		slog.Warn("登录失败: 密码错误")
		return "", fmt.Errorf("密码错误")
	}

	slog.Debug("密码验证通过，生成token")
	return generateToken(ip, userAgent)
}

// SetPassword 设置/修改密码
func SetPassword(oldPassword, newPassword string) error {
	hash := config.GetPasswordHash()

	if hash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)); err != nil {
			return fmt.Errorf("旧密码错误")
		}
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("密码加密失败", "error", err)
		return fmt.Errorf("密码加密失败: %w", err)
	}

	slog.Info("密码已更新")
	return config.SetPasswordHash(string(newHash))
}

// SetPasswordAndLogin 设置/修改密码并返回新 token
func SetPasswordAndLogin(oldPassword, newPassword, ip, userAgent string) (string, error) {
	if err := SetPassword(oldPassword, newPassword); err != nil {
		return "", err
	}
	return generateToken(ip, userAgent)
}

// IsPasswordSet 是否已设置密码
func IsPasswordSet() bool {
	return config.GetPasswordHash() != ""
}

// ValidateToken 验证 JWT token，返回 token ID（jti）
func ValidateToken(tokenStr string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(config.GetJWTSecret()), nil
	})
	if err != nil {
		return "", err
	}
	if !token.Valid {
		return "", fmt.Errorf("无效的 token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("无效的 token claims")
	}

	jti, _ := claims["jti"].(string)
	if jti == "" {
		return "", nil
	}

	dbToken, err := repository.GetTokenByID(jti)
	if err != nil {
		return "", fmt.Errorf("token 不存在")
	}
	if dbToken.Status != "active" {
		return "", fmt.Errorf("token 已被吊销")
	}

	return jti, nil
}

func generateToken(ip, userAgent string) (string, error) {
	tokenID := uuid.New().String()
	expireTime := time.Now().Add(time.Duration(config.GetJWTExpireHours()) * time.Hour)

	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": expireTime.Unix(),
		"jti": tokenID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(config.GetJWTSecret()))
	if err != nil {
		return "", err
	}

	dbToken := &model.Token{
		ID:        tokenID,
		Type:      "login",
		Status:    "active",
		IP:        ip,
		UserAgent: userAgent,
		ExpiresAt: &expireTime,
	}
	if err := repository.CreateToken(dbToken); err != nil {
		slog.Error("保存 token 记录失败", "error", err)
	}

	return tokenStr, nil
}

// GenerateAPIToken 生成 API token
func GenerateAPIToken(name string, expiresInHours *int, ip, userAgent string) (string, *model.Token, error) {
	tokenID := uuid.New().String()

	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"jti": tokenID,
	}

	var expiresAt *time.Time
	if expiresInHours != nil && *expiresInHours > 0 {
		t := time.Now().Add(time.Duration(*expiresInHours) * time.Hour)
		expiresAt = &t
		claims["exp"] = t.Unix()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(config.GetJWTSecret()))
	if err != nil {
		return "", nil, err
	}

	dbToken := &model.Token{
		ID:        tokenID,
		Type:      "api",
		Name:      name,
		Status:    "active",
		IP:        ip,
		UserAgent: userAgent,
		ExpiresAt: expiresAt,
	}
	if err := repository.CreateToken(dbToken); err != nil {
		return "", nil, fmt.Errorf("保存 API token 失败: %w", err)
	}

	return tokenStr, dbToken, nil
}
