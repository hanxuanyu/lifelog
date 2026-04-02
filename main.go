package main

import (
	"fmt"
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/config"
	"github.com/hxuanyu/lifelog/repository"
	"github.com/hxuanyu/lifelog/router"
)

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
	router.Setup(r)

	port := config.GetPort()
	slog.Info("服务启动", "port", port)
	if err := r.Run(fmt.Sprintf(":%d", port)); err != nil {
		slog.Error("服务启动失败", "error", err)
	}
}
