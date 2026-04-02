package config

import (
	"log/slog"
	"os"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/spf13/viper"
)

const defaultConfigYAML = `server:
  port: 8080
  db_path: "./data/lifelog.db"

auth:
  password_hash: ""
  jwt_secret: "change-me-to-a-random-string"
  jwt_expire_hours: 168

time_point_mode: "end"

categories:
  - name: "工作"
    rules:
      - type: fixed
        pattern: "开会"
      - type: fixed
        pattern: "写代码"
      - type: regex
        pattern: "^(需求|开发|测试|部署).*"
  - name: "学习"
    rules:
      - type: fixed
        pattern: "读书"
      - type: regex
        pattern: "^学习.*"
  - name: "生活"
    rules:
      - type: regex
        pattern: "^(吃饭|午餐|晚餐|早餐|做饭)$"
  - name: "休息"
    rules:
      - type: fixed
        pattern: "睡觉"
      - type: fixed
        pattern: "午休"
`

var (
	mu         sync.RWMutex
	categories []model.Category
)

// Init 初始化配置，如果 config.yaml 不存在则创建默认配置
func Init() {
	ensureConfigFile()

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")

	if err := viper.ReadInConfig(); err != nil {
		slog.Error("读取配置文件失败", "error", err)
		os.Exit(1)
	}

	loadCategories()

	viper.OnConfigChange(func(e fsnotify.Event) {
		slog.Info("配置文件已变更，重新加载", "file", e.Name)
		loadCategories()
	})
	viper.WatchConfig()

	slog.Info("配置加载完成",
		"port", GetPort(),
		"db_path", GetDBPath(),
		"time_point_mode", GetTimePointMode(),
		"categories_count", len(GetCategories()),
	)
}

func ensureConfigFile() {
	if _, err := os.Stat("config.yaml"); err == nil {
		return
	}
	slog.Info("config.yaml 不存在，创建默认配置文件")
	if err := os.WriteFile("config.yaml", []byte(defaultConfigYAML), 0644); err != nil {
		slog.Error("创建默认配置文件失败", "error", err)
		os.Exit(1)
	}
}

func loadCategories() {
	mu.Lock()
	defer mu.Unlock()

	var cats []model.Category
	if err := viper.UnmarshalKey("categories", &cats); err != nil {
		slog.Error("解析大类配置失败", "error", err)
		return
	}
	categories = cats
	slog.Info("大类配置已加载", "count", len(categories))
}

// GetCategories 获取当前大类配置（并发安全）
func GetCategories() []model.Category {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]model.Category, len(categories))
	copy(result, categories)
	return result
}

// GetPort 获取服务端口
func GetPort() int {
	return viper.GetInt("server.port")
}

// GetDBPath 获取数据库路径
func GetDBPath() string {
	return viper.GetString("server.db_path")
}

// GetTimePointMode 获取时间点模式 ("end" 或 "start")
func GetTimePointMode() string {
	mode := viper.GetString("time_point_mode")
	if mode != "start" {
		return "end"
	}
	return "start"
}

// GetJWTSecret 获取 JWT 密钥
func GetJWTSecret() string {
	return viper.GetString("auth.jwt_secret")
}

// GetJWTExpireHours 获取 JWT 过期时间（小时）
func GetJWTExpireHours() int {
	h := viper.GetInt("auth.jwt_expire_hours")
	if h <= 0 {
		return 168
	}
	return h
}

// GetPasswordHash 获取密码 hash
func GetPasswordHash() string {
	return viper.GetString("auth.password_hash")
}

// SetPasswordHash 写入密码 hash 到配置文件
func SetPasswordHash(hash string) error {
	viper.Set("auth.password_hash", hash)
	return viper.WriteConfig()
}
