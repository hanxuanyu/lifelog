package repository

import (
	"log/slog"
	"os"
	"path/filepath"

	"github.com/hxuanyu/lifelog/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接并自动迁移
func InitDB(dbPath string) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		slog.Error("创建数据库目录失败", "error", err)
		os.Exit(1)
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		slog.Error("连接数据库失败", "error", err)
		os.Exit(1)
	}

	if err := DB.AutoMigrate(&model.LogEntry{}); err != nil {
		slog.Error("数据库迁移失败", "error", err)
		os.Exit(1)
	}

	slog.Info("数据库初始化完成", "path", dbPath)
}
