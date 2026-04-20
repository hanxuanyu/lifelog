package service

import (
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hxuanyu/lifelog/internal/config"
)

var (
	blacklist   = make(map[string]time.Time)
	blacklistMu sync.RWMutex
)

func BlacklistToken(tokenStr string) {
	expiry := time.Now().Add(time.Duration(config.GetJWTExpireHours()) * time.Hour)

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.GetJWTSecret()), nil
	})
	if err == nil && token.Valid {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if exp, err := claims.GetExpirationTime(); err == nil && exp != nil {
				expiry = exp.Time
			}
		}
	}

	blacklistMu.Lock()
	blacklist[tokenStr] = expiry
	blacklistMu.Unlock()
}

func IsTokenBlacklisted(tokenStr string) bool {
	blacklistMu.RLock()
	defer blacklistMu.RUnlock()
	exp, ok := blacklist[tokenStr]
	if !ok {
		return false
	}
	return time.Now().Before(exp)
}

func StartBlacklistCleanup() {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			blacklistMu.Lock()
			now := time.Now()
			for token, exp := range blacklist {
				if now.After(exp) {
					delete(blacklist, token)
				}
			}
			blacklistMu.Unlock()
		}
	}()
}
