package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/config"
	lifelogmcp "github.com/hxuanyu/lifelog/internal/mcp"
	"github.com/hxuanyu/lifelog/internal/repository"
	"github.com/hxuanyu/lifelog/internal/router"
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
	config.Init()
	repository.InitDB(config.GetDBPath())

	r := gin.Default()
	staticFS, _ := fs.Sub(webFS, "web")
	router.Setup(r, staticFS)

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
