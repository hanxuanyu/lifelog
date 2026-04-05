package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// StartMCPServer 启动 MCP 服务
func StartMCPServer(port int) {
	mcpServer := server.NewMCPServer(
		"lifelog-mcp",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	mcpServer.AddTool(mcp.NewTool("query_logs",
		mcp.WithDescription("查询日志记录，支持按日期、事项类型、关键词筛选"),
		mcp.WithString("date", mcp.Description("日期 YYYY-MM-DD")),
		mcp.WithString("start_date", mcp.Description("开始日期 YYYY-MM-DD")),
		mcp.WithString("end_date", mcp.Description("结束日期 YYYY-MM-DD")),
		mcp.WithString("event_type", mcp.Description("事项类型")),
		mcp.WithString("keyword", mcp.Description("关键词")),
		mcp.WithNumber("page", mcp.Description("页码，默认1")),
		mcp.WithNumber("size", mcp.Description("每页数量，默认20")),
	), handleQueryLogs)

	mcpServer.AddTool(mcp.NewTool("get_daily_statistics",
		mcp.WithDescription("获取某天的统计数据，包含各分类时长占比"),
		mcp.WithString("date", mcp.Description("日期 YYYY-MM-DD"), mcp.Required()),
	), handleGetDailyStatistics)

	mcpServer.AddTool(mcp.NewTool("get_period_statistics",
		mcp.WithDescription("获取日期范围内每天的分类统计趋势"),
		mcp.WithString("start_date", mcp.Description("开始日期 YYYY-MM-DD"), mcp.Required()),
		mcp.WithString("end_date", mcp.Description("结束日期 YYYY-MM-DD"), mcp.Required()),
	), handleGetPeriodStatistics)

	mcpServer.AddTool(mcp.NewTool("get_categories",
		mcp.WithDescription("获取所有分类规则"),
	), handleGetCategories)

	mcpServer.AddTool(mcp.NewTool("get_event_types",
		mcp.WithDescription("获取所有不重复的事项类型"),
	), handleGetEventTypes)

	sseServer := server.NewSSEServer(mcpServer)
	addr := fmt.Sprintf(":%d", port)
	slog.Info("MCP服务启动", "port", port)
	if err := sseServer.Start(addr); err != nil {
		slog.Error("MCP服务启动失败", "error", err)
	}
}

func toJSON(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

func handleQueryLogs(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	q := repository.LogEntryQuery{
		Date:      request.GetString("date", ""),
		StartDate: request.GetString("start_date", ""),
		EndDate:   request.GetString("end_date", ""),
		EventType: request.GetString("event_type", ""),
		Keyword:   request.GetString("keyword", ""),
		Page:      request.GetInt("page", 1),
		Size:      request.GetInt("size", 20),
	}
	entries, total, err := service.QueryLogEntries(q, "")
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
	}
	result := map[string]interface{}{"total": total, "items": entries}
	return mcp.NewToolResultText(toJSON(result)), nil
}

func handleGetDailyStatistics(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	date := request.GetString("date", "")
	if date == "" {
		return mcp.NewToolResultError("date 参数必填"), nil
	}
	stats, err := service.GetDailyStatistics(date)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
	}
	return mcp.NewToolResultText(toJSON(stats)), nil
}

func handleGetPeriodStatistics(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	startDate := request.GetString("start_date", "")
	endDate := request.GetString("end_date", "")
	if startDate == "" || endDate == "" {
		return mcp.NewToolResultError("start_date 和 end_date 参数必填"), nil
	}
	stats, err := service.GetTrendStatistics(startDate, endDate)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
	}
	return mcp.NewToolResultText(toJSON(stats)), nil
}

func handleGetCategories(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	cats := config.GetCategories()
	return mcp.NewToolResultText(toJSON(cats)), nil
}

func handleGetEventTypes(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	types, err := repository.GetDistinctEventTypes()
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
	}
	return mcp.NewToolResultText(toJSON(types)), nil
}
