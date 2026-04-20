package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

// tool 定义列表，用于注册和日志输出
type toolDef struct {
	tool    mcp.Tool
	handler mcpserver.ToolHandlerFunc
}

// authMiddleware 验证 Bearer token，未设置密码时放行
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !service.IsPasswordSet() {
			next.ServeHTTP(w, r)
			return
		}

		auth := r.Header.Get("Authorization")
		if auth == "" {
			slog.Warn("MCP 认证失败: 未提供认证信息", "ip", r.RemoteAddr)
			http.Error(w, "未提供认证信息", http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(auth, "Bearer ")
		if token == auth {
			slog.Warn("MCP 认证失败: 格式错误", "ip", r.RemoteAddr)
			http.Error(w, "认证格式错误，请使用 Bearer token", http.StatusUnauthorized)
			return
		}

		if _, err := service.ValidateToken(token); err != nil {
			slog.Warn("MCP 认证失败: token无效", "ip", r.RemoteAddr, "error", err)
			http.Error(w, "认证失败: "+err.Error(), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// StartMCPServer 启动 MCP 服务
func StartMCPServer(port int) {
	slog.Info("MCP 服务初始化中",
		"name", "lifelog-mcp",
		"version", "1.0.0",
		"transport", "SSE",
		"port", port,
		"auth", service.IsPasswordSet(),
	)

	s := mcpserver.NewMCPServer(
		"lifelog-mcp",
		"1.0.0",
		mcpserver.WithToolCapabilities(true),
	)

	tools := []toolDef{
		{
			tool: mcp.NewTool("query_logs",
				mcp.WithDescription("查询日志记录，支持按日期、事项类型、关键词筛选"),
				mcp.WithString("date", mcp.Description("日期 YYYY-MM-DD")),
				mcp.WithString("start_date", mcp.Description("开始日期 YYYY-MM-DD")),
				mcp.WithString("end_date", mcp.Description("结束日期 YYYY-MM-DD")),
				mcp.WithString("event_type", mcp.Description("事项类型")),
				mcp.WithString("keyword", mcp.Description("关键词")),
				mcp.WithNumber("page", mcp.Description("页码，默认1")),
				mcp.WithNumber("size", mcp.Description("每页数量，默认20")),
			),
			handler: handleQueryLogs,
		},
		{
			tool: mcp.NewTool("get_daily_statistics",
				mcp.WithDescription("获取某天的统计数据，包含各分类时长占比"),
				mcp.WithString("date", mcp.Description("日期 YYYY-MM-DD"), mcp.Required()),
			),
			handler: handleGetDailyStatistics,
		},
		{
			tool: mcp.NewTool("get_period_statistics",
				mcp.WithDescription("获取日期范围内每天的分类统计趋势"),
				mcp.WithString("start_date", mcp.Description("开始日期 YYYY-MM-DD"), mcp.Required()),
				mcp.WithString("end_date", mcp.Description("结束日期 YYYY-MM-DD"), mcp.Required()),
			),
			handler: handleGetPeriodStatistics,
		},
		{
			tool: mcp.NewTool("get_categories",
				mcp.WithDescription("获取所有分类规则"),
			),
			handler: handleGetCategories,
		},
		{
			tool: mcp.NewTool("get_event_types",
				mcp.WithDescription("获取所有不重复的事项类型"),
			),
			handler: handleGetEventTypes,
		},
	}

	for _, t := range tools {
		s.AddTool(t.tool, t.handler)
		slog.Info("MCP 工具已注册", "tool", t.tool.Name, "description", t.tool.Description)
	}

	slog.Info("MCP 服务就绪", "tools_count", len(tools), "endpoint", fmt.Sprintf("http://localhost:%d/sse", port))

	sseServer := mcpserver.NewSSEServer(s)
	addr := fmt.Sprintf("0.0.0.0:%d", port)

	// 使用自定义 HTTP 服务器包装认证中间件
	httpServer := &http.Server{
		Addr:    addr,
		Handler: authMiddleware(sseServer),
	}

	if err := httpServer.ListenAndServe(); err != nil {
		slog.Error("MCP 服务启动失败", "error", err)
	}
}

func toJSON(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

func withLog(name string, params map[string]string, fn func() (*mcp.CallToolResult, error)) (*mcp.CallToolResult, error) {
	start := time.Now()
	slog.Info("MCP 工具调用", "tool", name, "params", params)
	result, err := fn()
	elapsed := time.Since(start)
	if err != nil {
		slog.Error("MCP 工具调用失败", "tool", name, "elapsed", elapsed, "error", err)
	} else {
		slog.Info("MCP 工具调用完成", "tool", name, "elapsed", elapsed)
	}
	return result, err
}

func handleQueryLogs(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	params := map[string]string{
		"date":       request.GetString("date", ""),
		"start_date": request.GetString("start_date", ""),
		"end_date":   request.GetString("end_date", ""),
		"event_type": request.GetString("event_type", ""),
		"keyword":    request.GetString("keyword", ""),
	}
	return withLog("query_logs", params, func() (*mcp.CallToolResult, error) {
		q := repository.LogEntryQuery{
			Date:      params["date"],
			StartDate: params["start_date"],
			EndDate:   params["end_date"],
			EventType: params["event_type"],
			Keyword:   params["keyword"],
			Page:      request.GetInt("page", 1),
			Size:      request.GetInt("size", 20),
		}
		entries, total, err := service.QueryLogEntries(q, "")
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
		}
		result := map[string]interface{}{"total": total, "items": entries}
		return mcp.NewToolResultText(toJSON(result)), nil
	})
}

func handleGetDailyStatistics(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	date := request.GetString("date", "")
	return withLog("get_daily_statistics", map[string]string{"date": date}, func() (*mcp.CallToolResult, error) {
		if date == "" {
			return mcp.NewToolResultError("date 参数必填"), nil
		}
		stats, err := service.GetDailyStatistics(date)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
		}
		return mcp.NewToolResultText(toJSON(stats)), nil
	})
}

func handleGetPeriodStatistics(_ context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	startDate := request.GetString("start_date", "")
	endDate := request.GetString("end_date", "")
	return withLog("get_period_statistics", map[string]string{"start_date": startDate, "end_date": endDate}, func() (*mcp.CallToolResult, error) {
		if startDate == "" || endDate == "" {
			return mcp.NewToolResultError("start_date 和 end_date 参数必填"), nil
		}
		stats, err := service.GetTrendStatistics(startDate, endDate)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
		}
		return mcp.NewToolResultText(toJSON(stats)), nil
	})
}

func handleGetCategories(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return withLog("get_categories", nil, func() (*mcp.CallToolResult, error) {
		cats := config.GetCategories()
		return mcp.NewToolResultText(toJSON(cats)), nil
	})
}

func handleGetEventTypes(_ context.Context, _ mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return withLog("get_event_types", nil, func() (*mcp.CallToolResult, error) {
		types, err := repository.GetDistinctEventTypes()
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("查询失败: %v", err)), nil
		}
		return mcp.NewToolResultText(toJSON(types)), nil
	})
}
