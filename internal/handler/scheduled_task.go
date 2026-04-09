package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/scheduler"
)

// GetScheduledTasks 获取所有定时任务
// @Summary 获取定时任务列表
// @Tags 定时任务
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/scheduled-tasks [get]
func GetScheduledTasks(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: scheduler.GetTasks()})
}

// UpdateScheduledTasks 批量更新定时任务配置
// @Summary 更新定时任务
// @Tags 定时任务
// @Accept json
// @Produce json
// @Param body body []model.ScheduledTaskConfig true "任务配置列表"
// @Success 200 {object} model.Response
// @Router /api/scheduled-tasks [put]
func UpdateScheduledTasks(c *gin.Context) {
	var tasks []model.ScheduledTaskConfig
	if err := c.ShouldBindJSON(&tasks); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := scheduler.UpdateTasks(tasks); err != nil {
		slog.Error("更新定时任务失败", "error", err)
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}

	slog.Info("定时任务已更新", "count", len(tasks))
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "更新成功", Data: scheduler.GetTasks()})
}

// RunScheduledTask 手动触发某个定时任务
// @Summary 手动执行定时任务
// @Tags 定时任务
// @Produce json
// @Param name path string true "任务名称"
// @Success 200 {object} model.Response
// @Router /api/scheduled-tasks/{name}/run [post]
func RunScheduledTask(c *gin.Context) {
	name := c.Param("name")
	if err := scheduler.RunTaskNow(name); err != nil {
		c.JSON(http.StatusNotFound, model.Response{Code: 404, Message: err.Error()})
		return
	}
	slog.Info("手动触发定时任务", "task", name)
	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "任务已触发"})
}
