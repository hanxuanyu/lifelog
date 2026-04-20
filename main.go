package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/events"
	"github.com/hxuanyu/lifelog/internal/logger"
	lifelogmcp "github.com/hxuanyu/lifelog/internal/mcp"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/router"
	"github.com/hxuanyu/lifelog/internal/scheduler"
	"github.com/hxuanyu/lifelog/internal/service"
	"github.com/hxuanyu/lifelog/internal/ws"
)

//go:embed web/*
var webFS embed.FS

// @title Lifelog API
// @version 1.0
// @description 无压力每日事项记录系统
// @host localhost:8080
// @BasePath /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	configDir := flag.String("c", "./config", "配置文件目录路径")
	flag.Parse()

	logger.Init("./logs")
	config.SetConfigDir(*configDir)
	config.Init()
	repository.InitDB(config.GetDBPath())

	// 初始化事件总线：将 webhook 执行器注册为全局订阅者
	events.SubscribeAll(&events.WebhookSubscriber{})

	// 初始化 WebSocket Hub 并注册为事件订阅者
	wsHub := ws.NewHub()
	go wsHub.Run()
	events.SubscribeAll(&ws.WSSubscriber{Hub: wsHub})

	// 启动 token 清理任务
	service.StartTokenCleanup()

	// 注册内置定时任务并启动调度器
	scheduler.RegisterBuiltinTasks()
	scheduler.Start()
	defer scheduler.Stop()

	r := gin.Default()
	staticFS, _ := fs.Sub(webFS, "web")
	router.Setup(r, staticFS, wsHub)

	// 启动 MCP 服务
	if config.GetMCPEnabled() {
		go lifelogmcp.StartMCPServer(config.GetMCPPort())
	}

	port := config.GetPort()
	slog.Info("服务启动", "port", port)
	if err := r.Run(fmt.Sprintf(":%d", port)); err != nil {
		slog.Error("服务启动失败", "error", err)
	}
}
