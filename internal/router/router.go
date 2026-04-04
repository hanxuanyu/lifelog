package router

import (
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/handler"
	"github.com/hxuanyu/lifelog/internal/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/hxuanyu/lifelog/docs"
)

// Setup 注册所有路由
func Setup(r *gin.Engine, staticFS fs.FS) {
	// Swagger 文档
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api")

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
		}

		// 设置
		protected.GET("/settings", handler.GetSettings)
		protected.PUT("/settings", handler.UpdateSettings)

		// 数据导入导出
		data := protected.Group("/data")
		{
			data.GET("/export", handler.ExportData)
			data.POST("/import", handler.ImportData)
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
