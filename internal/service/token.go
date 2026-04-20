package service

import (
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

var (
	lastUsedMu    sync.Mutex
	lastUsedCache = make(map[string]time.Time)
)

func GetAllTokens() ([]model.Token, error) {
	return repository.GetAllTokens()
}

func RevokeToken(id string) error {
	return repository.RevokeToken(id)
}

func RevokeAllExcept(currentID string) error {
	return repository.RevokeAllExcept(currentID)
}

func UpdateLastUsed(tokenID string) {
	if tokenID == "" {
		return
	}
	now := time.Now()

	lastUsedMu.Lock()
	last, ok := lastUsedCache[tokenID]
	if ok && now.Sub(last) < 5*time.Minute {
		lastUsedMu.Unlock()
		return
	}
	lastUsedCache[tokenID] = now
	lastUsedMu.Unlock()

	repository.UpdateLastUsedAt(tokenID, now)
}

func StartTokenCleanup() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			repository.CleanupExpiredTokens()

			lastUsedMu.Lock()
			for id := range lastUsedCache {
				if t, err := repository.GetTokenByID(id); err != nil || t.Status != "active" {
					delete(lastUsedCache, id)
				}
			}
			lastUsedMu.Unlock()
		}
	}()
}
