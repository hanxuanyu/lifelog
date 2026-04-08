package model

// SystemMonitor 服务器资源监控信息
type SystemMonitor struct {
	// OS 级别
	CPUUsage    float64 `json:"cpu_usage"`
	CPUCores    int     `json:"cpu_cores"`
	OSMemUsed   uint64  `json:"os_mem_used"`
	OSMemTotal  uint64  `json:"os_mem_total"`
	OSMemPercent float64 `json:"os_mem_percent"`

	// 进程级别（Go runtime）
	GoMemAlloc   uint64 `json:"go_mem_alloc"`
	GoMemSys     uint64 `json:"go_mem_sys"`
	GoMemGCSys   uint64 `json:"go_mem_gc_sys"`
	GoGCCount    uint32 `json:"go_gc_count"`
	GoGCPauseMs  float64 `json:"go_gc_pause_ms"`
	Goroutines   int    `json:"goroutines"`
	GoVersion    string `json:"go_version"`

	// 磁盘
	DiskUsed    uint64  `json:"disk_used"`
	DiskTotal   uint64  `json:"disk_total"`
	DiskPercent float64 `json:"disk_percent"`

	// 运行时间
	UptimeSeconds int64 `json:"uptime_seconds"`

	// 目录信息
	Directories []DirInfo `json:"directories"`
}

// DirInfo 目录信息
type DirInfo struct {
	Label     string `json:"label"`
	Path      string `json:"path"`
	SizeBytes int64  `json:"size_bytes"`
	FileCount int    `json:"file_count"`
	Exists    bool   `json:"exists"`
}
