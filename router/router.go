package router

import (
	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/handler"
	"github.com/hxuanyu/lifelog/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/hxuanyu/lifelog/docs"
)

// Setup 注册所有路由
func Setup(r *gin.Engine) {
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
			logs.GET("/:id", handler.GetLogEntry)
			logs.PUT("/:id", handler.UpdateLogEntry)
			logs.DELETE("/:id", handler.DeleteLogEntry)
		}

		// 大类（只读）
		protected.GET("/categories", handler.GetCategories)

		// 统计
		stats := protected.Group("/statistics")
		{
			stats.GET("/daily", handler.GetDailyStatistics)
			stats.GET("/weekly", handler.GetWeeklyStatistics)
			stats.GET("/monthly", handler.GetMonthlyStatistics)
		}

		// 设置
		protected.GET("/settings", handler.GetSettings)
	}
}
