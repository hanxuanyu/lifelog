package router

import (
	"io/fs"
	"net/http"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/handler"
	"github.com/hxuanyu/lifelog/internal/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/hxuanyu/lifelog/docs"
)

// Setup 注册所有路由
func Setup(r *gin.Engine, staticFS fs.FS) {
	// Gzip 压缩中间件；SSE 流式接口需要跳过压缩，否则可能被缓冲后一次性返回
	r.Use(gzip.Gzip(gzip.DefaultCompression, gzip.WithExcludedPaths([]string{"/api/ai/chat"})))
	// Swagger 文档
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api")

	// 版本信息（无需认证）
	api.GET("/version", handler.GetVersion)
	api.GET("/check-update", handler.CheckUpdate)

	// 认证相关（无需 token）
	auth := api.Group("/auth")
	{
		auth.POST("/login", handler.Login)
		auth.PUT("/password", handler.SetPassword)
	}

	// 以下路由需要认证
	protected := api.Group("")
	protected.Use(middleware.AuthRequired())
	{
		// 日志
		logs := protected.Group("/logs")
		{
			logs.POST("", handler.CreateLogEntry)
			logs.GET("", handler.QueryLogEntries)
			logs.GET("/timeline", handler.GetTimeline)
			logs.GET("/event-types", handler.GetEventTypes)
			logs.GET("/:id", handler.GetLogEntry)
			logs.PUT("/:id", handler.UpdateLogEntry)
			logs.DELETE("/:id", handler.DeleteLogEntry)
		}

		// 大类
		protected.GET("/categories", handler.GetCategories)
		protected.PUT("/categories", handler.UpdateCategories)

		// 统计
		stats := protected.Group("/statistics")
		{
			stats.GET("/daily", handler.GetDailyStatistics)
			stats.GET("/weekly", handler.GetWeeklyStatistics)
			stats.GET("/monthly", handler.GetMonthlyStatistics)
			stats.GET("/trend", handler.GetTrendStatistics)
		}

		// 设置
		protected.GET("/settings", handler.GetSettings)
		protected.PUT("/settings", handler.UpdateSettings)

		// 系统监控
		protected.GET("/system/monitor", handler.GetSystemMonitor)

		// Webhooks
		webhooks := protected.Group("/webhooks")
		{
			webhooks.GET("", handler.GetWebhooks)
			webhooks.POST("", handler.CreateWebhook)
			webhooks.POST("/test-dry", handler.TestWebhookDry)
			webhooks.PUT("/:name", handler.UpdateWebhook)
			webhooks.DELETE("/:name", handler.DeleteWebhook)
			webhooks.POST("/:name/test", handler.TestWebhook)
		}

		// 事件
		protected.GET("/events", handler.GetEvents)
		protected.GET("/event-bindings", handler.GetEventBindings)
		protected.PUT("/event-bindings", handler.UpdateEventBindings)

		// 定时任务
		scheduledTasks := protected.Group("/scheduled-tasks")
		{
			scheduledTasks.GET("", handler.GetScheduledTasks)
			scheduledTasks.PUT("", handler.UpdateScheduledTasks)
			scheduledTasks.POST("/:name/run", handler.RunScheduledTask)
		}

		// 数据导入导出
		data := protected.Group("/data")
		{
			data.GET("/export", handler.ExportData)
			data.POST("/import", handler.ImportData)
		}

		// AI
		ai := protected.Group("/ai")
		{
			ai.GET("/providers", handler.GetAIProviders)
			ai.POST("/providers", handler.AddAIProvider)
			ai.PUT("/providers/:name", handler.UpdateAIProvider)
			ai.DELETE("/providers/:name", handler.DeleteAIProvider)
			ai.POST("/providers/test", handler.TestAIProvider)
			ai.POST("/models", handler.FetchModels)
			ai.POST("/chat", handler.AIChat)
		}
	}

	// 静态文件服务 - 嵌入前端构建产物
	fileServer := http.FileServer(http.FS(staticFS))
	r.NoRoute(func(c *gin.Context) {
		// 尝试提供静态文件
		path := c.Request.URL.Path
		if f, err := fs.ReadFile(staticFS.(fs.ReadFileFS), path[1:]); err == nil && len(f) > 0 {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}
		// SPA fallback: 返回 index.html
		c.Request.URL.Path = "/"
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}
