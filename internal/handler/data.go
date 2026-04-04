package handler

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
)

// exportData 导出数据的结构
type exportData struct {
	ExportedAt string           `json:"exported_at"`
	Version    string           `json:"version"`
	Logs       []model.LogEntry `json:"logs"`
}

// exportConfig 导出配置的结构
type exportConfig struct {
	TimePointMode string           `json:"time_point_mode"`
	Categories    []model.Category `json:"categories"`
}

// importRequest 导入请求参数
type importRequest struct {
	MergeLogs    bool `json:"merge_logs"`    // true: 合并, false: 替换
	ImportConfig bool `json:"import_config"` // 是否导入配置
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
		Categories:    config.GetCategories(),
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
	c.Data(http.StatusOK, "application/zip", buf.Bytes())
}

// ImportData 从 zip 导入数据
// @Summary 导入数据
// @Tags 数据管理
// @Accept multipart/form-data
// @Produce json
// @Param file formance file true "导出的 zip 文件"
// @Param merge_logs formData bool false "是否合并日志（true=合并，false=替换）"
// @Param import_config formData bool false "是否导入配置"
// @Success 200 {object} model.Response
// @Router /api/data/import [post]
func ImportData(c *gin.Context) {
	mergeLogs := c.PostForm("merge_logs") == "true"
	importConfig := c.PostForm("import_config") == "true"

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
	if importConfig && cfgData != nil {
		if err := config.SetTimePointMode(cfgData.TimePointMode); err != nil {
			result["config_error"] = "设置时间模式失败: " + err.Error()
		}
		if err := config.SetCategoriesConfig(cfgData.Categories); err != nil {
			result["config_error"] = "设置分类规则失败: " + err.Error()
		}
		result["config_imported"] = true
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "导入完成", Data: result})
}
