package service

import (
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"sync"
	"time"

	"github.com/hxuanyu/lifelog/internal/config"
	"github.com/hxuanyu/lifelog/internal/model"
)

var startTime = time.Now()

// CPU 采样相关
var (
	cpuMu      sync.RWMutex
	cpuUsage   float64 = -1
)

func init() {
	// 后台 goroutine 每 2 秒采样一次 CPU
	go func() {
		for {
			usage := sampleCPU()
			cpuMu.Lock()
			cpuUsage = usage
			cpuMu.Unlock()
			time.Sleep(2 * time.Second)
		}
	}()
}

func getCPUUsage() float64 {
	cpuMu.RLock()
	defer cpuMu.RUnlock()
	return cpuUsage
}

// GetSystemMonitor 获取系统监控信息
func GetSystemMonitor() model.SystemMonitor {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// GC 暂停时间（最近一次）
	var gcPauseMs float64
	var gcStats debug.GCStats
	debug.ReadGCStats(&gcStats)
	if len(gcStats.Pause) > 0 {
		gcPauseMs = float64(gcStats.Pause[0].Microseconds()) / 1000.0
	}

	monitor := model.SystemMonitor{
		CPUUsage:   getCPUUsage(),
		CPUCores:   runtime.NumCPU(),
		GoMemAlloc:  m.Alloc,
		GoMemSys:    m.Sys,
		GoMemGCSys:  m.GCSys,
		GoGCCount:   m.NumGC,
		GoGCPauseMs: gcPauseMs,
		Goroutines:  runtime.NumGoroutine(),
		GoVersion:   runtime.Version(),
		UptimeSeconds: int64(time.Since(startTime).Seconds()),
	}

	// OS 内存
	osUsed, osTotal := getOSMemory()
	if osTotal > 0 {
		monitor.OSMemUsed = osUsed
		monitor.OSMemTotal = osTotal
		monitor.OSMemPercent = float64(osUsed) / float64(osTotal) * 100
	}

	// 数据目录磁盘
	dbPath := config.GetDBPath()
	dir := filepath.Dir(dbPath)
	if dir == "" || dir == "." {
		dir, _ = os.Getwd()
	}
	diskTotal, diskFree := getDiskUsage(dir)
	if diskTotal > 0 {
		monitor.DiskTotal = diskTotal
		monitor.DiskUsed = diskTotal - diskFree
		monitor.DiskPercent = float64(diskTotal-diskFree) / float64(diskTotal) * 100
	}

	// 目录信息
	monitor.Directories = collectDirInfo()

	return monitor
}

// collectDirInfo 收集应用相关目录信息
func collectDirInfo() []model.DirInfo {
	dbPath := config.GetDBPath()
	dataDir := filepath.Dir(dbPath)
	if dataDir == "" || dataDir == "." {
		dataDir, _ = os.Getwd()
		dataDir = filepath.Join(dataDir, "data")
	}

	logDir := "./logs"
	configDir := "./config"

	return []model.DirInfo{
		scanDir("数据目录", dataDir),
		scanDir("日志目录", logDir),
		scanDir("配置目录", configDir),
	}
}

func scanDir(label, dir string) model.DirInfo {
	absPath, _ := filepath.Abs(dir)
	info := model.DirInfo{
		Label: label,
		Path:  absPath,
	}

	stat, err := os.Stat(dir)
	if err != nil || !stat.IsDir() {
		info.Exists = false
		return info
	}
	info.Exists = true

	var totalSize int64
	var fileCount int
	_ = filepath.Walk(dir, func(_ string, fi os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !fi.IsDir() {
			totalSize += fi.Size()
			fileCount++
		}
		return nil
	})
	info.SizeBytes = totalSize
	info.FileCount = fileCount
	return info
}
