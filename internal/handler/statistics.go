package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

// GetDailyStatistics 日统计
// @Summary 获取某天的统计数据
// @Tags 统计
// @Produce json
// @Param date query string true "日期 YYYY-MM-DD"
// @Success 200 {object} model.Response{data=model.DailyStatistics}
// @Router /api/statistics/daily [get]
func GetDailyStatistics(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "date 参数必填"})
		return
	}

	stats, err := service.GetDailyStatistics(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: stats})
}

// GetWeeklyStatistics 周统计
// @Summary 获取某天所在周的统计数据
// @Tags 统计
// @Produce json
// @Param date query string true "日期 YYYY-MM-DD"
// @Success 200 {object} model.Response{data=model.PeriodStatistics}
// @Router /api/statistics/weekly [get]
func GetWeeklyStatistics(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "date 参数必填"})
		return
	}

	stats, err := service.GetWeeklyStatistics(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: stats})
}

// GetMonthlyStatistics 月统计
// @Summary 获取某月的统计数据
// @Tags 统计
// @Produce json
// @Param year query int true "年份"
// @Param month query int true "月份"
// @Success 200 {object} model.Response{data=model.PeriodStatistics}
// @Router /api/statistics/monthly [get]
func GetMonthlyStatistics(c *gin.Context) {
	yearStr := c.Query("year")
	monthStr := c.Query("month")
	if yearStr == "" || monthStr == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "year 和 month 参数必填"})
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "无效的年份"})
		return
	}
	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "无效的月份"})
		return
	}

	stats, err := service.GetMonthlyStatistics(year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: stats})
}

// GetTrendStatistics 趋势统计
// @Summary 获取日期范围内每天的分类汇总
// @Tags 统计
// @Produce json
// @Param start_date query string true "开始日期 YYYY-MM-DD"
// @Param end_date query string true "结束日期 YYYY-MM-DD"
// @Success 200 {object} model.Response{data=model.TrendStatistics}
// @Router /api/statistics/trend [get]
func GetTrendStatistics(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "start_date 和 end_date 参数必填"})
		return
	}

	stats, err := service.GetTrendStatistics(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.Response{Code: 200, Message: "ok", Data: stats})
}
