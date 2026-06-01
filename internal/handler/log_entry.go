package handler

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
)

// CreateLogEntry 新增日志
// @Summary 新增日志条目
// @Tags 日志
// @Accept json
// @Produce json
// @Param body body model.LogEntryRequest true "日志内容"
// @Success 200 {object} model.Response{data=model.LogEntryResponse}
// @Failure 400 {object} model.Response
// @Router /api/logs [post]
func CreateLogEntry(c *gin.Context) {
	var req model.LogEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	entry, err := service.CreateLogEntry(req)
	if err != nil {
		slog.Error("创建日志失败", "error", err, "event_type", req.EventType)
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}

	resp := service.ToResponse(entry)
	slog.Debug("日志已创建", "id", entry.ID, "date", entry.LogDate, "event_type", entry.EventType)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "创建成功", Data: resp})
	go events.Publish("log.created", map[string]string{
		"log_id": fmt.Sprintf("%d", entry.ID), "log_date": entry.LogDate,
		"log_time": entry.LogTime, "event_type": entry.EventType,
		"detail": entry.Detail, "category": resp.Category,
	})
}

// CreateLogMarker creates a temporary time marker.
func CreateLogMarker(c *gin.Context) {
	var req model.LogMarkerRequest
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "鍙傛暟閿欒: " + err.Error()})
			return
		}
	}

	entry, err := service.CreateLogMarker(req)
	if err != nil {
		slog.Error("鍒涘缓涓存椂鎵撴爣澶辫触", "error", err)
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}

	resp := service.ToResponse(entry)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "鍒涘缓鎴愬姛", Data: resp})
	go events.Publish("log.marker.created", map[string]string{
		"log_id":   fmt.Sprintf("%d", entry.ID),
		"log_date": entry.LogDate,
		"log_time": entry.LogTime,
		"source":   strings.TrimSpace(req.Source),
	})
}

// InferLogSuggestions returns likely event candidates for a time point.
func InferLogSuggestions(c *gin.Context) {
	var req model.LogSuggestionRequest
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "鍙傛暟閿欒: " + err.Error()})
			return
		}
	}
	if req.LogDate == "" {
		req.LogDate = c.Query("log_date")
	}
	if req.LogTime == "" {
		req.LogTime = c.Query("log_time")
	}
	if req.Limit == 0 {
		req.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "0"))
	}
	if req.WindowDays == 0 {
		req.WindowDays, _ = strconv.Atoi(c.DefaultQuery("window_days", "0"))
	}

	result, err := service.InferLogSuggestions(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: result})
}

// GetLogEntry 获取单条日志
// @Summary 获取单条日志
// @Tags 日志
// @Produce json
// @Param id path int true "日志ID"
// @Success 200 {object} model.Response{data=model.LogEntryResponse}
// @Failure 404 {object} model.Response
// @Router /api/logs/{id} [get]
func GetLogEntry(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	resp, err := service.GetLogEntry(id)
	if err != nil {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: "日志不存在"})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: resp})
}

// UpdateLogEntry 修改日志
// @Summary 修改日志条目
// @Tags 日志
// @Accept json
// @Produce json
// @Param id path int true "日志ID"
// @Param body body model.LogEntryRequest true "日志内容"
// @Success 200 {object} model.Response{data=model.LogEntryResponse}
// @Failure 400,404 {object} model.Response
// @Router /api/logs/{id} [put]
func UpdateLogEntry(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req model.LogEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	entry, err := service.UpdateLogEntry(id, req)
	if err != nil {
		slog.Error("更新日志失败", "error", err, "id", id)
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}

	resp := service.ToResponse(entry)
	slog.Debug("日志已更新", "id", id, "event_type", entry.EventType)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功", Data: resp})
	go events.Publish("log.updated", map[string]string{
		"log_id": fmt.Sprintf("%d", entry.ID), "log_date": entry.LogDate,
		"log_time": entry.LogTime, "event_type": entry.EventType,
		"detail": entry.Detail, "category": resp.Category,
	})
}

// DeleteLogEntry 删除日志
// @Summary 删除日志条目
// @Tags 日志
// @Produce json
// @Param id path int true "日志ID"
// @Success 200 {object} model.Response
// @Failure 400 {object} model.Response
// @Router /api/logs/{id} [delete]
func DeleteLogEntry(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err := service.DeleteLogEntry(id); err != nil {
		slog.Error("删除日志失败", "error", err, "id", id)
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "删除失败: " + err.Error()})
		return
	}

	slog.Info("日志已删除", "id", id)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "删除成功"})
	go events.Publish("log.deleted", map[string]string{"log_id": fmt.Sprintf("%d", id)})
}

// QueryLogEntries 查询日志列表
// @Summary 查询日志列表
// @Tags 日志
// @Produce json
// @Param date query string false "日期 YYYY-MM-DD"
// @Param start_date query string false "起始日期 YYYY-MM-DD"
// @Param end_date query string false "结束日期 YYYY-MM-DD"
// @Param event_type query string false "事项类型"
// @Param category query string false "大类名称"
// @Param keyword query string false "关键词"
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Success 200 {object} model.Response{data=model.PageResult}
// @Router /api/logs [get]
func QueryLogEntries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	q := repository.LogEntryQuery{
		Date:      c.Query("date"),
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
		EventType: c.Query("event_type"),
		Keyword:   c.Query("keyword"),
		Page:      page,
		Size:      size,
	}
	if markerQuery := c.Query("marker"); markerQuery != "" {
		marker := markerQuery == "true" || markerQuery == "1"
		q.Marker = &marker
	}
	category := c.Query("category")

	entries, total, err := service.QueryLogEntries(q, category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "查询失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "ok",
		Data: model.PageResult{
			Total: total,
			Page:  page,
			Size:  size,
			Items: entries,
		},
	})
}

// GetTimeline 获取某天时间轴
// @Summary 获取某天时间轴
// @Tags 日志
// @Produce json
// @Param date query string true "日期 YYYY-MM-DD"
// @Success 200 {object} model.Response{data=[]model.LogEntryResponse}
// @Router /api/logs/timeline [get]
func GetTimeline(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "date 参数必填"})
		return
	}

	entries, err := service.GetTimeline(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "查询失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: entries})
}

// GetEventTypes 获取所有不重复的事项类型
// @Summary 获取所有事项类型
// @Tags 日志
// @Produce json
// @Success 200 {object} model.Response{data=[]string}
// @Router /api/logs/event-types [get]
func GetEventTypes(c *gin.Context) {
	types, err := repository.GetDistinctEventTypes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: "查询失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: types})
}

func parseID(c *gin.Context) (uint, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "无效的ID"})
		return 0, err
	}
	return uint(id), nil
}
