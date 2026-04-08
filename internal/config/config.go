package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
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
    color: "#3b82f6"
    rules:
      - type: fixed
        pattern: "开会"
      - type: fixed
        pattern: "写文档"
      - type: fixed
        pattern: "编程"
      - type: fixed
        pattern: "沟通"
      - type: fixed
        pattern: "汇报"
      - type: fixed
        pattern: "工单"
  - name: "成长"
    color: "#10b981"
    rules:
      - type: fixed
        pattern: "学习"
      - type: fixed
        pattern: "阅读"
      - type: fixed
        pattern: "课程"
      - type: fixed
        pattern: "健身"
      - type: fixed
        pattern: "考试"
  - name: "休息"
    color: "#8b5cf6"
    rules:
      - type: regex
        pattern: "^(睡觉|午睡)$"
      - type: fixed
        pattern: "午睡"
      - type: fixed
        pattern: "睡觉"
      - type: fixed
        pattern: "放松"
      - type: fixed
        pattern: "发呆"
  - name: "交通"
    color: "#0ea5e9"
    rules:
      - type: regex
        pattern: "^(步行|打车|地铁|公交|高铁|飞机|骑车)$"
      - type: fixed
        pattern: "步行"
      - type: fixed
        pattern: "飞机"
      - type: fixed
        pattern: "高铁"
      - type: fixed
        pattern: "打车"
      - type: fixed
        pattern: "骑车"
      - type: fixed
        pattern: "地铁"
      - type: fixed
        pattern: "开车"
      - type: fixed
        pattern: "通勤"
      - type: fixed
        pattern: "候机"
      - type: fixed
        pattern: "候车"
  - name: "吃喝"
    color: "#f97316"
    rules:
      - type: fixed
        pattern: "早饭"
      - type: fixed
        pattern: "晚饭"
      - type: fixed
        pattern: "午饭"
      - type: fixed
        pattern: "饭"
      - type: fixed
        pattern: "聚餐"
      - type: fixed
        pattern: "下午茶"
      - type: fixed
        pattern: "夜宵"
      - type: fixed
        pattern: "零食"
  - name: "玩乐"
    color: "#ec4899"
    rules:
      - type: fixed
        pattern: "游戏"
      - type: fixed
        pattern: "视频"
      - type: fixed
        pattern: "追剧"
      - type: fixed
        pattern: "逛街"
      - type: fixed
        pattern: "兴趣活动"
  - name: "家务"
    color: "#78716c"
    rules:
      - type: fixed
        pattern: "打扫"
      - type: fixed
        pattern: "洗衣"
      - type: fixed
        pattern: "收纳"
      - type: fixed
        pattern: "修理"
      - type: fixed
        pattern: "做饭"

mcp:
  enabled: false
  port: 8081
`

var (
	mu          sync.RWMutex
	categories  []model.Category
	aiProviders []model.AIProvider
	configDir   = "./config" // 默认配置目录
)

// SetConfigDir 设置配置文件目录（需在 Init 之前调用）
func SetConfigDir(dir string) {
	configDir = dir
}

// Init 初始化配置，如果 config.yaml 不存在则创建默认配置
// 配置文件固定在 configDir 目录下（默认 ./config/）
// 支持环境变量覆盖，前缀为 LIFELOG_，层级用 _ 分隔
// 例如: LIFELOG_SERVER_PORT=9090 覆盖 server.port
func Init() {
	ensureConfigFile()

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(configDir)

	if err := viper.ReadInConfig(); err != nil {
		slog.Error("读取配置文件失败", "error", err)
		os.Exit(1)
	}

	// 环境变量覆盖：LIFELOG_SERVER_PORT -> server.port
	viper.SetEnvPrefix("LIFELOG")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// 显式绑定所有已知配置项，确保环境变量能正确覆盖
	bindEnvKeys()

	loadCategories()
	loadAIProviders()

	viper.OnConfigChange(func(e fsnotify.Event) {
		slog.Info("配置文件已变更，重新加载", "file", e.Name)
		loadCategories()
		loadAIProviders()
	})
	viper.WatchConfig()

	slog.Info("配置加载完成",
		"port", GetPort(),
		"db_path", GetDBPath(),
		"time_point_mode", GetTimePointMode(),
		"categories_count", len(GetCategories()),
	)
}

// bindEnvKeys 显式绑定配置键到环境变量
// viper.AutomaticEnv 仅对已知键生效，需显式绑定嵌套键
func bindEnvKeys() {
	keys := []string{
		"server.port",
		"server.db_path",
		"auth.password_hash",
		"auth.jwt_secret",
		"auth.jwt_expire_hours",
		"time_point_mode",
		"mcp.enabled",
		"mcp.port",
	}
	for _, key := range keys {
		_ = viper.BindEnv(key)
	}
}

func ensureConfigFile() {
	configPath := filepath.Join(configDir, "config.yaml")
	if info, err := os.Stat(configPath); err == nil && !info.IsDir() {
		return
	}
	if err := os.MkdirAll(configDir, 0755); err != nil {
		slog.Error("创建配置目录失败", "error", err, "dir", configDir)
		os.Exit(1)
	}
	slog.Info("配置文件不存在，创建默认配置", "path", configPath)
	if err := os.WriteFile(configPath, []byte(defaultConfigYAML), 0644); err != nil {
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

// SetTimePointMode 设置时间点模式并写入配置文件（热重载生效）
func SetTimePointMode(mode string) error {
	if mode != "start" && mode != "end" {
		mode = "end"
	}
	viper.Set("time_point_mode", mode)
	return viper.WriteConfig()
}

// SetCategoriesConfig 设置分类规则并写入配置文件（热重载生效）
func SetCategoriesConfig(cats []model.Category) error {
	viper.Set("categories", cats)
	if err := viper.WriteConfig(); err != nil {
		return err
	}
	// 主动触发重新加载
	loadCategories()
	return nil
}

func loadAIProviders() {
	mu.Lock()
	defer mu.Unlock()

	var providers []model.AIProvider
	if err := viper.UnmarshalKey("ai.providers", &providers); err != nil {
		slog.Error("解析AI配置失败", "error", err)
		return
	}
	aiProviders = providers
	slog.Info("AI配置已加载", "count", len(aiProviders))
}

// GetAIProviders 获取AI服务提供商列表（并发安全）
func GetAIProviders() []model.AIProvider {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]model.AIProvider, len(aiProviders))
	copy(result, aiProviders)
	return result
}

// SetAIProviders 设置AI服务提供商并写入配置文件
func SetAIProviders(providers []model.AIProvider) error {
	viper.Set("ai.providers", providers)
	if err := viper.WriteConfig(); err != nil {
		return err
	}
	loadAIProviders()
	return nil
}

// GetDefaultAIProvider 获取默认AI服务提供商
func GetDefaultAIProvider() *model.AIProvider {
	mu.RLock()
	defer mu.RUnlock()
	for _, p := range aiProviders {
		if p.Default {
			cp := p
			return &cp
		}
	}
	if len(aiProviders) > 0 {
		cp := aiProviders[0]
		return &cp
	}
	return nil
}

// GetMCPEnabled 获取MCP是否启用
func GetMCPEnabled() bool {
	return viper.GetBool("mcp.enabled")
}

// GetMCPPort 获取MCP服务端口
func GetMCPPort() int {
	p := viper.GetInt("mcp.port")
	if p <= 0 {
		return 8081
	}
	return p
}

// GetMCPConfig 获取MCP配置
func GetMCPConfig() map[string]interface{} {
	return map[string]interface{}{
		"enabled": GetMCPEnabled(),
		"port":    GetMCPPort(),
	}
}

// SetMCPConfig 设置MCP配置（需重启生效）
func SetMCPConfig(enabled *bool, port *int) error {
	if enabled != nil {
		viper.Set("mcp.enabled", *enabled)
	}
	if port != nil && *port > 0 {
		viper.Set("mcp.port", *port)
	}
	return viper.WriteConfig()
}

// GetServerConfig 获取服务器配置（端口、数据库路径）
func GetServerConfig() map[string]interface{} {
	return map[string]interface{}{
		"port":    GetPort(),
		"db_path": GetDBPath(),
	}
}

// GetAuthConfig 获取认证配置（不含密码哈希）
func GetAuthConfig() map[string]interface{} {
	return map[string]interface{}{
		"jwt_expire_hours": GetJWTExpireHours(),
	}
}

// SetServerConfig 设置服务器配置（需重启生效）
func SetServerConfig(port int, dbPath string) error {
	if port > 0 {
		viper.Set("server.port", port)
	}
	if dbPath != "" {
		viper.Set("server.db_path", dbPath)
	}
	return viper.WriteConfig()
}

// SetAuthConfig 设置认证配置
func SetAuthConfig(jwtExpireHours int) error {
	if jwtExpireHours > 0 {
		viper.Set("auth.jwt_expire_hours", jwtExpireHours)
	}
	return viper.WriteConfig()
}
