package handler

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/scheduler"
)

// exportData 导出数据的结构
type exportData struct {
	ExportedAt string           `json:"exported_at"`
	Version    string           `json:"version"`
	Logs       []model.LogEntry `json:"logs"`
}

// exportConfig 导出配置的结构
type exportConfig struct {
	TimePointMode  string                      `json:"time_point_mode"`
	Server         exportServerConfig          `json:"server"`
	Auth           exportAuthConfig            `json:"auth"`
	AI             exportAIConfig              `json:"ai"`
	Categories     []model.Category            `json:"categories"`
	Webhooks       []model.Webhook             `json:"webhooks"`
	EventBindings  []model.EventBinding        `json:"event_bindings"`
	ScheduledTasks []model.ScheduledTaskConfig `json:"scheduled_tasks"`
	Prompts        []model.Prompt              `json:"prompts"`
	MCP            exportMCPConfig             `json:"mcp"`
}

type exportServerConfig struct {
	Port   int    `json:"port"`
	DBPath string `json:"db_path"`
}

type exportAuthConfig struct {
	PasswordHash   string `json:"password_hash"`
	JWTSecret      string `json:"jwt_secret"`
	JWTExpireHours int    `json:"jwt_expire_hours"`
}

type exportAIConfig struct {
	Providers    []model.AIProvider `json:"providers"`
	DefaultModel string             `json:"default_model"`
}

type exportMCPConfig struct {
	Enabled bool `json:"enabled"`
	Port    int  `json:"port"`
}

const (
	importConfigBasic          = "basic"
	importConfigAuth           = "auth"
	importConfigAI             = "ai"
	importConfigCategories     = "categories"
	importConfigWebhooks       = "webhooks"
	importConfigScheduledTasks = "scheduled_tasks"
	importConfigPrompts        = "prompts"
)

var allImportConfigTypes = []string{
	importConfigBasic,
	importConfigAuth,
	importConfigAI,
	importConfigCategories,
	importConfigWebhooks,
	importConfigScheduledTasks,
	importConfigPrompts,
}

// ExportData 导出全量数据和配置到 zip
// @Summary 导出数据
// @Tags 数据管理
// @Produce application/zip
// @Success 200 {file} file
// @Router /api/data/export [get]
func ExportData(c *gin.Context) {
	// 获取全量日志
	var logs []model.LogEntry
	if err := repository.DB.Order("log_date ASC, log_time ASC").Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "查询日志失败: " + err.Error()})
		return
	}

	// 构建导出数据
	data := exportData{
		ExportedAt: time.Now().Format(time.RFC3339),
		Version:    "1.0",
		Logs:       logs,
	}

	cfg := exportConfig{
		TimePointMode: config.GetTimePointMode(),
		Server: exportServerConfig{
			Port:   config.GetPort(),
			DBPath: config.GetDBPath(),
		},
		Auth: exportAuthConfig{
			PasswordHash:   config.GetPasswordHash(),
			JWTSecret:      config.GetJWTSecret(),
			JWTExpireHours: config.GetJWTExpireHours(),
		},
		AI: exportAIConfig{
			Providers:    config.GetAIProviders(),
			DefaultModel: config.GetDefaultAIModel(),
		},
		Categories:     config.GetCategories(),
		Webhooks:       config.GetWebhooks(),
		EventBindings:  config.GetEventBindings(),
		ScheduledTasks: config.GetScheduledTasks(),
		Prompts:        config.GetCustomPrompts(),
		MCP: exportMCPConfig{
			Enabled: config.GetMCPEnabled(),
			Port:    config.GetMCPPort(),
		},
	}

	// 创建 zip
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// 写入 logs.json
	logsJSON, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "序列化日志失败"})
		return
	}
	f, err := w.Create("logs.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "创建压缩文件失败"})
		return
	}
	if _, err := f.Write(logsJSON); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "写入日志数据失败"})
		return
	}

	// 写入 config.json
	cfgJSON, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "序列化配置失败"})
		return
	}
	f2, err := w.Create("config.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "创建压缩文件失败"})
		return
	}
	if _, err := f2.Write(cfgJSON); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "写入配置数据失败"})
		return
	}

	if err := w.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "关闭压缩文件失败"})
		return
	}

	filename := fmt.Sprintf("lifelog-export-%s.zip", time.Now().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	slog.Info("数据导出完成", "logs_count", len(logs), "filename", filename)
	c.Data(http.StatusOK, "application/zip", buf.Bytes())
	go events.Publish("data.exported", map[string]string{"timestamp": time.Now().Format(time.RFC3339)})
}

// ImportData 从 zip 导入数据
// @Summary 导入数据
// @Tags 数据管理
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "导出的 zip 文件"
// @Param merge_logs formData bool false "是否合并日志（true=合并，false=替换）"
// @Param import_config formData bool false "是否导入配置"
// @Param import_config_types formData []string false "导入的配置类型，可选：basic/auth/ai/categories/webhooks"
// @Success 200 {object} model.Response
// @Router /api/data/import [post]
func ImportData(c *gin.Context) {
	mergeLogs := c.PostForm("merge_logs") == "true"
	importConfig := c.PostForm("import_config") == "true"
	selectedConfigTypes := normalizeImportConfigTypes(c.PostFormArray("import_config_types"))
	if len(selectedConfigTypes) > 0 {
		importConfig = true
	}
	if importConfig && len(selectedConfigTypes) == 0 {
		selectedConfigTypes = append([]string(nil), allImportConfigTypes...)
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "请上传文件"})
		return
	}

	// 限制文件大小 100MB
	if file.Size > 100*1024*1024 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "文件大小不能超过 100MB"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "读取文件失败"})
		return
	}
	defer f.Close()

	body, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "读取文件内容失败"})
		return
	}

	reader, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "无效的 zip 文件"})
		return
	}

	var logsData *exportData
	var cfgData *exportConfig

	for _, zf := range reader.File {
		rc, err := zf.Open()
		if err != nil {
			continue
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			continue
		}

		switch zf.Name {
		case "logs.json":
			var d exportData
			if err := json.Unmarshal(content, &d); err != nil {
				c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "logs.json 格式无效: " + err.Error()})
				return
			}
			logsData = &d
		case "config.json":
			var cfg exportConfig
			if err := json.Unmarshal(content, &cfg); err != nil {
				c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "config.json 格式无效: " + err.Error()})
				return
			}
			cfgData = &cfg
		}
	}

	if logsData == nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "zip 中未找到 logs.json"})
		return
	}

	result := map[string]interface{}{}

	// 处理日志导入
	if mergeLogs {
		// 合并模式：按 log_date + log_time + event_type 去重
		imported, skipped := 0, 0
		for _, entry := range logsData.Logs {
			var count int64
			repository.DB.Model(&model.LogEntry{}).
				Where("log_date = ? AND log_time = ? AND event_type = ?", entry.LogDate, entry.LogTime, entry.EventType).
				Count(&count)
			if count > 0 {
				skipped++
				continue
			}
			newEntry := model.LogEntry{
				LogDate:       entry.LogDate,
				LogTime:       entry.LogTime,
				EventType:     entry.EventType,
				Detail:        entry.Detail,
				TimePointMode: entry.TimePointMode,
			}
			if err := repository.DB.Create(&newEntry).Error; err != nil {
				skipped++
				continue
			}
			imported++
		}
		result["logs_imported"] = imported
		result["logs_skipped"] = skipped
		result["logs_total"] = len(logsData.Logs)
	} else {
		// 替换模式：清空后导入
		if err := repository.DB.Where("1 = 1").Delete(&model.LogEntry{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "清空日志失败: " + err.Error()})
			return
		}
		imported := 0
		for _, entry := range logsData.Logs {
			newEntry := model.LogEntry{
				LogDate:       entry.LogDate,
				LogTime:       entry.LogTime,
				EventType:     entry.EventType,
				Detail:        entry.Detail,
				TimePointMode: entry.TimePointMode,
			}
			if err := repository.DB.Create(&newEntry).Error; err != nil {
				continue
			}
			imported++
		}
		result["logs_imported"] = imported
		result["logs_total"] = len(logsData.Logs)
	}

	// 处理配置导入
	if importConfig {
		if cfgData == nil {
			result["config_errors"] = []string{"zip 中未找到 config.json，无法导入配置"}
		} else {
			importedTypes := make([]string, 0, len(selectedConfigTypes))
			hotReloadedTypes := make([]string, 0)
			restartRequiredTypes := make([]string, 0)
			configErrors := make([]string, 0)

			for _, configType := range selectedConfigTypes {
				switch configType {
				case importConfigBasic:
					if err := config.SetTimePointMode(cfgData.TimePointMode); err != nil {
						configErrors = append(configErrors, "设置时间模式失败: "+err.Error())
						break
					}
					if err := config.SetServerConfig(cfgData.Server.Port, cfgData.Server.DBPath); err != nil {
						configErrors = append(configErrors, "导入服务器配置失败: "+err.Error())
						break
					}
					if err := config.SetMCPConfig(&cfgData.MCP.Enabled, &cfgData.MCP.Port); err != nil {
						configErrors = append(configErrors, "导入 MCP 配置失败: "+err.Error())
						break
					}
					if err := config.SetAIDefaultModel(cfgData.AI.DefaultModel); err != nil {
						configErrors = append(configErrors, "瀵煎叆 AI 榛樿妯″瀷澶辫触: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					restartRequiredTypes = append(restartRequiredTypes, "服务端口", "数据库路径", "MCP 配置")
					hotReloadedTypes = append(hotReloadedTypes, "时间点模式")
				case importConfigAuth:
					if err := config.SetAuthBackupConfig(&cfgData.Auth.PasswordHash, &cfgData.Auth.JWTSecret, &cfgData.Auth.JWTExpireHours); err != nil {
						configErrors = append(configErrors, "导入认证配置失败: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					restartRequiredTypes = append(restartRequiredTypes, "认证配置")
				case importConfigAI:
					providers := cfgData.AI.Providers
					if providers == nil {
						providers = []model.AIProvider{}
					}
					if err := config.SetAIProviders(providers); err != nil {
						configErrors = append(configErrors, "导入 AI 配置失败: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					hotReloadedTypes = append(hotReloadedTypes, "AI 配置")
				case importConfigCategories:
					categories := cfgData.Categories
					if categories == nil {
						categories = []model.Category{}
					}
					if err := config.SetCategoriesConfig(categories); err != nil {
						configErrors = append(configErrors, "设置分类规则失败: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					hotReloadedTypes = append(hotReloadedTypes, "分类规则")
				case importConfigWebhooks:
					webhooks := cfgData.Webhooks
					if webhooks == nil {
						webhooks = []model.Webhook{}
					}
					if err := config.SetWebhooks(webhooks); err != nil {
						configErrors = append(configErrors, "导入 Webhook 失败: "+err.Error())
						break
					}
					bindings := cfgData.EventBindings
					if bindings == nil {
						bindings = []model.EventBinding{}
					}
					if err := config.SetEventBindings(bindings); err != nil {
						configErrors = append(configErrors, "导入事件绑定失败: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					hotReloadedTypes = append(hotReloadedTypes, "Webhook", "事件绑定")
				case importConfigScheduledTasks:
					tasks := cfgData.ScheduledTasks
					if tasks == nil {
						tasks = []model.ScheduledTaskConfig{}
					}
					if err := config.SetScheduledTasks(tasks); err != nil {
						configErrors = append(configErrors, "导入定时任务失败: "+err.Error())
						break
					}
					scheduler.ReloadFromConfig()
					importedTypes = append(importedTypes, configType)
					hotReloadedTypes = append(hotReloadedTypes, "定时任务")
				case importConfigPrompts:
					prompts := cfgData.Prompts
					if prompts == nil {
						prompts = []model.Prompt{}
					}
					if err := config.SetCustomPrompts(prompts); err != nil {
						configErrors = append(configErrors, "导入提示词失败: "+err.Error())
						break
					}
					importedTypes = append(importedTypes, configType)
					hotReloadedTypes = append(hotReloadedTypes, "提示词")
				}
			}

			if len(importedTypes) > 0 {
				result["config_imported"] = true
				result["config_imported_types"] = importedTypes
			}
			if len(hotReloadedTypes) > 0 {
				result["config_hot_reloaded"] = hotReloadedTypes
			}
			if len(restartRequiredTypes) > 0 {
				result["config_need_restart"] = true
				result["config_need_restart_types"] = restartRequiredTypes
			}
			if len(configErrors) > 0 {
				result["config_errors"] = configErrors
				result["config_error"] = strings.Join(configErrors, "；")
			}
		}
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "导入完成", Data: result})
	slog.Info("数据导入完成", "merge", mergeLogs, "import_config", importConfig, "result", result)
	go events.Publish("data.imported", map[string]string{
		"logs_imported": fmt.Sprintf("%v", result["logs_imported"]),
		"logs_skipped":  fmt.Sprintf("%v", result["logs_skipped"]),
		"timestamp":     time.Now().Format(time.RFC3339),
	})
}

func normalizeImportConfigTypes(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	allowed := make(map[string]struct{}, len(allImportConfigTypes))
	for _, item := range allImportConfigTypes {
		allowed[item] = struct{}{}
	}

	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, raw := range values {
		for _, item := range strings.Split(raw, ",") {
			name := strings.TrimSpace(item)
			if name == "" {
				continue
			}
			if _, ok := allowed[name]; !ok {
				continue
			}
			if _, exists := seen[name]; exists {
				continue
			}
			seen[name] = struct{}{}
			result = append(result, name)
		}
	}

	return result
}
