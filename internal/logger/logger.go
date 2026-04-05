package logger

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

// Init 初始化日志系统，同时输出到控制台和文件
func Init(logDir string) {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		slog.Error("创建日志目录失败", "error", err, "dir", logDir)
		return
	}

	logPath := filepath.Join(logDir, "lifelog.log")

	fileWriter := &lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    50, // MB
		MaxBackups: 5,
		MaxAge:     30, // days
		Compress:   true,
	}

	multiWriter := io.MultiWriter(os.Stdout, fileWriter)

	handler := slog.NewTextHandler(multiWriter, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	slog.SetDefault(slog.New(handler))

	slog.Info("日志系统初始化完成", "dir", logDir, "file", logPath)
}
