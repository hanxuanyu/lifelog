package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/spf13/viper"
	"go.yaml.in/yaml/v3"
)

const (
	baseConfigFileName       = "config.yaml"
	categoriesConfigFileName = "categories.yaml"
	webhookConfigFileName    = "webhooks.yaml"
)

type serverConfig struct {
	Port   int    `mapstructure:"port" yaml:"port"`
	DBPath string `mapstructure:"db_path" yaml:"db_path"`
}

type authConfig struct {
	PasswordHash   string `mapstructure:"password_hash" yaml:"password_hash"`
	JWTSecret      string `mapstructure:"jwt_secret" yaml:"jwt_secret"`
	JWTExpireHours int    `mapstructure:"jwt_expire_hours" yaml:"jwt_expire_hours"`
}

type mcpConfig struct {
	Enabled bool `mapstructure:"enabled" yaml:"enabled"`
	Port    int  `mapstructure:"port" yaml:"port"`
}

type aiProvidersConfig struct {
	Providers []model.AIProvider `mapstructure:"providers" yaml:"providers"`
}

type baseFileConfig struct {
	Server        serverConfig      `mapstructure:"server" yaml:"server"`
	Auth          authConfig        `mapstructure:"auth" yaml:"auth"`
	TimePointMode string            `mapstructure:"time_point_mode" yaml:"time_point_mode"`
	AI            aiProvidersConfig `mapstructure:"ai" yaml:"ai"`
	MCP           mcpConfig         `mapstructure:"mcp" yaml:"mcp"`
}

type categoriesFileConfig struct {
	Categories []model.Category `mapstructure:"categories" yaml:"categories"`
}

type webhookFileConfig struct {
	Webhooks       []model.Webhook             `mapstructure:"webhooks" yaml:"webhooks"`
	EventBindings  []model.EventBinding        `mapstructure:"event_bindings" yaml:"event_bindings"`
	ScheduledTasks []model.ScheduledTaskConfig `mapstructure:"scheduled_tasks" yaml:"scheduled_tasks"`
}

var (
	mu          sync.RWMutex
	categories  []model.Category
	aiProviders []model.AIProvider
	configDir   = "./config"

	baseViper       = viper.New()
	categoriesViper = viper.New()
	webhookViper    = viper.New()
)

// SetConfigDir sets the config directory before Init is called.
func SetConfigDir(dir string) {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return
	}
	configDir = filepath.Clean(dir)
}

// Init loads config files.
func Init() {
	if err := ensureSplitConfigFiles(); err != nil {
		slog.Error("failed to prepare config files", "error", err, "dir", configDir)
		os.Exit(1)
	}

	var err error
	baseViper, err = loadConfigViper(baseConfigFileName)
	if err != nil {
		slog.Error("failed to load base config", "error", err)
		os.Exit(1)
	}
	applyBaseDefaults(baseViper)

	categoriesViper, err = loadConfigViper(categoriesConfigFileName)
	if err != nil {
		slog.Error("failed to load categories config", "error", err)
		os.Exit(1)
	}

	webhookViper, err = loadConfigViper(webhookConfigFileName)
	if err != nil {
		slog.Error("failed to load webhook config", "error", err)
		os.Exit(1)
	}

	loadCategories()
	loadAIProviders()
	loadWebhooks()
	loadEventBindings()
	loadScheduledTasks()

	watchConfigFile(baseViper, loadAIProviders)
	watchConfigFile(categoriesViper, loadCategories)
	watchConfigFile(webhookViper, func() {
		loadWebhooks()
		loadEventBindings()
		loadScheduledTasks()
	})

	slog.Info("configuration loaded",
		"dir", configDir,
		"port", GetPort(),
		"db_path", GetDBPath(),
		"time_point_mode", GetTimePointMode(),
		"categories_count", len(GetCategories()),
		"webhooks_count", len(GetWebhooks()),
		"ai_providers_count", len(GetAIProviders()),
	)
}

func ensureSplitConfigFiles() error {
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	files := []struct {
		name string
		data interface{}
	}{
		{name: baseConfigFileName, data: defaultBaseConfig()},
		{name: categoriesConfigFileName, data: defaultCategoriesConfig()},
		{name: webhookConfigFileName, data: defaultWebhookConfig()},
	}

	for _, file := range files {
		path := configPath(file.name)
		if fileExists(path) {
			continue
		}
		if err := writeYAMLFile(path, file.data); err != nil {
			return fmt.Errorf("write %s: %w", file.name, err)
		}
	}

	return nil
}

func loadConfigViper(filename string) (*viper.Viper, error) {
	cfg := viper.New()
	cfg.SetConfigFile(configPath(filename))
	cfg.SetConfigType("yaml")
	if err := cfg.ReadInConfig(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func watchConfigFile(cfg *viper.Viper, reload func()) {
	cfg.OnConfigChange(func(e fsnotify.Event) {
		slog.Info("config file changed", "file", filepath.Base(e.Name))
		if reload != nil {
			reload()
		}
	})
	cfg.WatchConfig()
}

func applyBaseDefaults(cfg *viper.Viper) {
	defaults := defaultBaseConfig()
	cfg.SetDefault("server.port", defaults.Server.Port)
	cfg.SetDefault("server.db_path", defaults.Server.DBPath)
	cfg.SetDefault("auth.password_hash", defaults.Auth.PasswordHash)
	cfg.SetDefault("auth.jwt_secret", defaults.Auth.JWTSecret)
	cfg.SetDefault("auth.jwt_expire_hours", defaults.Auth.JWTExpireHours)
	cfg.SetDefault("time_point_mode", defaults.TimePointMode)
	cfg.SetDefault("ai.providers", defaults.AI.Providers)
	cfg.SetDefault("mcp.enabled", defaults.MCP.Enabled)
	cfg.SetDefault("mcp.port", defaults.MCP.Port)
}

func writeYAMLFile(path string, data interface{}) error {
	content, err := yaml.Marshal(data)
	if err != nil {
		return err
	}
	if len(content) == 0 || content[len(content)-1] != '\n' {
		content = append(content, '\n')
	}
	return os.WriteFile(path, content, 0644)
}

func configPath(filename string) string {
	return filepath.Join(configDir, filename)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func defaultBaseConfig() baseFileConfig {
	return baseFileConfig{
		Server: serverConfig{
			Port:   8080,
			DBPath: "./data/lifelog.db",
		},
		Auth: authConfig{
			PasswordHash:   "",
			JWTSecret:      "change-me-to-a-random-string",
			JWTExpireHours: 168,
		},
		TimePointMode: "end",
		AI: aiProvidersConfig{
			Providers: []model.AIProvider{},
		},
		MCP: mcpConfig{
			Enabled: false,
			Port:    8081,
		},
	}
}

func defaultCategoriesConfig() categoriesFileConfig {
	return categoriesFileConfig{
		Categories: []model.Category{
			{
				Name:  "工作",
				Color: "#3b82f6",
				Rules: []model.CategoryRule{
					{Type: "fixed", Pattern: "开会"},
					{Type: "fixed", Pattern: "写文档"},
					{Type: "fixed", Pattern: "编程"},
					{Type: "fixed", Pattern: "沟通"},
					{Type: "fixed", Pattern: "汇报"},
					{Type: "fixed", Pattern: "工单"},
				},
			},
			{
				Name:  "成长",
				Color: "#10b981",
				Rules: []model.CategoryRule{
					{Type: "fixed", Pattern: "学习"},
					{Type: "fixed", Pattern: "阅读"},
					{Type: "fixed", Pattern: "课程"},
					{Type: "fixed", Pattern: "健身"},
					{Type: "fixed", Pattern: "考试"},
				},
			},
			{
				Name:  "休息",
				Color: "#8b5cf6",
				Rules: []model.CategoryRule{
					{Type: "regex", Pattern: "^(睡觉|午睡)$"},
					{Type: "fixed", Pattern: "午睡"},
					{Type: "fixed", Pattern: "睡觉"},
					{Type: "fixed", Pattern: "放松"},
					{Type: "fixed", Pattern: "发呆"},
				},
			},
			{
				Name:  "交通",
				Color: "#0ea5e9",
				Rules: []model.CategoryRule{
					{Type: "regex", Pattern: "^(步行|打车|地铁|公交|高铁|飞机|骑车)$"},
					{Type: "fixed", Pattern: "步行"},
					{Type: "fixed", Pattern: "飞机"},
					{Type: "fixed", Pattern: "高铁"},
					{Type: "fixed", Pattern: "打车"},
					{Type: "fixed", Pattern: "骑车"},
					{Type: "fixed", Pattern: "地铁"},
					{Type: "fixed", Pattern: "开车"},
					{Type: "fixed", Pattern: "通勤"},
					{Type: "fixed", Pattern: "候机"},
					{Type: "fixed", Pattern: "候车"},
				},
			},
			{
				Name:  "吃喝",
				Color: "#f97316",
				Rules: []model.CategoryRule{
					{Type: "fixed", Pattern: "早饭"},
					{Type: "fixed", Pattern: "晚饭"},
					{Type: "fixed", Pattern: "午饭"},
					{Type: "fixed", Pattern: "饭"},
					{Type: "fixed", Pattern: "聚餐"},
					{Type: "fixed", Pattern: "下午茶"},
					{Type: "fixed", Pattern: "夜宵"},
					{Type: "fixed", Pattern: "零食"},
				},
			},
			{
				Name:  "玩乐",
				Color: "#ec4899",
				Rules: []model.CategoryRule{
					{Type: "fixed", Pattern: "游戏"},
					{Type: "fixed", Pattern: "视频"},
					{Type: "fixed", Pattern: "追剧"},
					{Type: "fixed", Pattern: "逛街"},
					{Type: "fixed", Pattern: "兴趣活动"},
				},
			},
			{
				Name:  "家务",
				Color: "#78716c",
				Rules: []model.CategoryRule{
					{Type: "fixed", Pattern: "打扫"},
					{Type: "fixed", Pattern: "洗衣"},
					{Type: "fixed", Pattern: "收纳"},
					{Type: "fixed", Pattern: "修理"},
					{Type: "fixed", Pattern: "做饭"},
				},
			},
		},
	}
}

func defaultWebhookConfig() webhookFileConfig {
	return webhookFileConfig{
		Webhooks:      []model.Webhook{},
		EventBindings: []model.EventBinding{},
		ScheduledTasks: []model.ScheduledTaskConfig{
			{Name: "daily_report", Cron: "0 22 * * *", Enabled: false},
			{Name: "weekly_report", Cron: "0 10 * * 1", Enabled: false},
			{Name: "monthly_report", Cron: "0 10 1 * *", Enabled: false},
			{Name: "no_log_reminder", Cron: "0 */2 * * *", Enabled: false},
			{Name: "uncategorized_reminder", Cron: "30 21 * * *", Enabled: false},
		},
	}
}

func loadCategories() {
	mu.Lock()
	defer mu.Unlock()

	var cats []model.Category
	if err := categoriesViper.UnmarshalKey("categories", &cats); err != nil {
		slog.Error("failed to parse categories config", "error", err)
		return
	}

	categories = cats
	slog.Info("categories config loaded", "count", len(categories))
}

// GetCategories returns the current category rules.
func GetCategories() []model.Category {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.Category, len(categories))
	copy(result, categories)
	return result
}

// GetPort returns the HTTP server port.
func GetPort() int {
	if port, ok := envInt("LIFELOG_SERVER_PORT"); ok && port > 0 {
		return port
	}
	port := baseViper.GetInt("server.port")
	if port <= 0 {
		return defaultBaseConfig().Server.Port
	}
	return port
}

// GetDBPath returns the sqlite database path.
func GetDBPath() string {
	if dbPath, ok := envString("LIFELOG_SERVER_DB_PATH"); ok && dbPath != "" {
		return dbPath
	}
	dbPath := strings.TrimSpace(baseViper.GetString("server.db_path"))
	if dbPath == "" {
		return defaultBaseConfig().Server.DBPath
	}
	return dbPath
}

// GetTimePointMode returns start or end mode.
func GetTimePointMode() string {
	mode := strings.TrimSpace(baseViper.GetString("time_point_mode"))
	if envMode, ok := envString("LIFELOG_TIME_POINT_MODE"); ok {
		mode = envMode
	}
	if mode != "start" {
		return "end"
	}
	return "start"
}

// GetJWTSecret returns the JWT secret.
func GetJWTSecret() string {
	if secret, ok := envString("LIFELOG_AUTH_JWT_SECRET"); ok {
		return secret
	}
	return baseViper.GetString("auth.jwt_secret")
}

// GetJWTExpireHours returns JWT expiry hours.
func GetJWTExpireHours() int {
	if hours, ok := envInt("LIFELOG_AUTH_JWT_EXPIRE_HOURS"); ok {
		if hours > 0 {
			return hours
		}
		return defaultBaseConfig().Auth.JWTExpireHours
	}
	hours := baseViper.GetInt("auth.jwt_expire_hours")
	if hours <= 0 {
		return defaultBaseConfig().Auth.JWTExpireHours
	}
	return hours
}

// GetPasswordHash returns the stored password hash.
func GetPasswordHash() string {
	if hash, ok := envString("LIFELOG_AUTH_PASSWORD_HASH"); ok {
		return hash
	}
	return baseViper.GetString("auth.password_hash")
}

// SetPasswordHash persists the password hash into config.yaml.
func SetPasswordHash(hash string) error {
	baseViper.Set("auth.password_hash", hash)
	return baseViper.WriteConfig()
}

// SetAuthBackupConfig persists auth settings from backup import into config.yaml.
func SetAuthBackupConfig(passwordHash, jwtSecret *string, jwtExpireHours *int) error {
	if passwordHash != nil {
		baseViper.Set("auth.password_hash", *passwordHash)
	}
	if jwtSecret != nil {
		baseViper.Set("auth.jwt_secret", *jwtSecret)
	}
	if jwtExpireHours != nil && *jwtExpireHours > 0 {
		baseViper.Set("auth.jwt_expire_hours", *jwtExpireHours)
	}
	return baseViper.WriteConfig()
}

// SetTimePointMode persists the time point mode into config.yaml.
func SetTimePointMode(mode string) error {
	if mode != "start" && mode != "end" {
		mode = "end"
	}
	baseViper.Set("time_point_mode", mode)
	return baseViper.WriteConfig()
}

// SetCategoriesConfig persists category rules into categories.yaml.
func SetCategoriesConfig(cats []model.Category) error {
	categoriesViper.Set("categories", cats)
	if err := categoriesViper.WriteConfig(); err != nil {
		return err
	}
	loadCategories()
	return nil
}

func loadAIProviders() {
	mu.Lock()
	defer mu.Unlock()

	var providers []model.AIProvider
	if err := baseViper.UnmarshalKey("ai.providers", &providers); err != nil {
		slog.Error("failed to parse ai config", "error", err)
		return
	}

	aiProviders = providers
	slog.Info("ai config loaded", "count", len(aiProviders))
}

// GetAIProviders returns all configured AI providers.
func GetAIProviders() []model.AIProvider {
	mu.RLock()
	defer mu.RUnlock()

	result := make([]model.AIProvider, len(aiProviders))
	copy(result, aiProviders)
	return result
}

// SetAIProviders persists AI providers into config.yaml.
func SetAIProviders(providers []model.AIProvider) error {
	baseViper.Set("ai.providers", providers)
	if err := baseViper.WriteConfig(); err != nil {
		return err
	}
	loadAIProviders()
	return nil
}

// GetDefaultAIProvider returns the default provider or the first configured provider.
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

// GetMCPEnabled returns whether the MCP server is enabled.
func GetMCPEnabled() bool {
	if enabled, ok := envBool("LIFELOG_MCP_ENABLED"); ok {
		return enabled
	}
	return baseViper.GetBool("mcp.enabled")
}

// GetMCPPort returns the MCP server port.
func GetMCPPort() int {
	if port, ok := envInt("LIFELOG_MCP_PORT"); ok {
		if port > 0 {
			return port
		}
		return defaultBaseConfig().MCP.Port
	}
	port := baseViper.GetInt("mcp.port")
	if port <= 0 {
		return defaultBaseConfig().MCP.Port
	}
	return port
}

// GetMCPConfig returns the MCP config for API responses.
func GetMCPConfig() map[string]interface{} {
	return map[string]interface{}{
		"enabled": GetMCPEnabled(),
		"port":    GetMCPPort(),
	}
}

// SetMCPConfig persists MCP settings into config.yaml.
func SetMCPConfig(enabled *bool, port *int) error {
	if enabled != nil {
		baseViper.Set("mcp.enabled", *enabled)
	}
	if port != nil && *port > 0 {
		baseViper.Set("mcp.port", *port)
	}
	return baseViper.WriteConfig()
}

// GetServerConfig returns the current server config for API responses.
func GetServerConfig() map[string]interface{} {
	return map[string]interface{}{
		"port":    GetPort(),
		"db_path": GetDBPath(),
	}
}

// GetAuthConfig returns the auth config exposed by the API.
func GetAuthConfig() map[string]interface{} {
	return map[string]interface{}{
		"jwt_expire_hours": GetJWTExpireHours(),
	}
}

// SetServerConfig persists server settings into config.yaml.
func SetServerConfig(port int, dbPath string) error {
	if port > 0 {
		baseViper.Set("server.port", port)
	}
	if dbPath != "" {
		baseViper.Set("server.db_path", dbPath)
	}
	return baseViper.WriteConfig()
}

// SetAuthConfig persists auth settings into config.yaml.
func SetAuthConfig(jwtExpireHours int) error {
	if jwtExpireHours > 0 {
		baseViper.Set("auth.jwt_expire_hours", jwtExpireHours)
	}
	return baseViper.WriteConfig()
}

func envString(key string) (string, bool) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return "", false
	}
	return strings.TrimSpace(value), true
}

func envInt(key string) (int, bool) {
	raw, ok := envString(key)
	if !ok || raw == "" {
		return 0, false
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		slog.Warn("ignoring invalid integer env override", "env", key, "value", raw, "error", err)
		return 0, false
	}

	return value, true
}

func envBool(key string) (bool, bool) {
	raw, ok := envString(key)
	if !ok || raw == "" {
		return false, false
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		slog.Warn("ignoring invalid boolean env override", "env", key, "value", raw, "error", err)
		return false, false
	}

	return value, true
}
