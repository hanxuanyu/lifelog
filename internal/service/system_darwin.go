//go:build darwin

package service

import (
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

func getDiskUsage(path string) (total, free uint64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0
	}
	total = stat.Blocks * uint64(stat.Bsize)
	free = stat.Bfree * uint64(stat.Bsize)
	return total, free
}

func getOSMemory() (used, total uint64) {
	// sysctl hw.memsize 获取物理内存总量
	out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
	if err != nil {
		return 0, 0
	}
	total, err = strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
	if err != nil || total == 0 {
		return 0, 0
	}

	// vm_stat 获取内存页面信息
	out, err = exec.Command("vm_stat").Output()
	if err != nil {
		return 0, total
	}

	pageSize := uint64(4096)
	fields := parseVMStat(string(out))

	// 解析 page size（第一行可能包含）
	if ps, ok := fields["page_size"]; ok && ps > 0 {
		pageSize = ps
	}

	freePages := fields["Pages free"]
	inactive := fields["Pages inactive"]
	speculative := fields["Pages speculative"]
	available := (freePages + inactive + speculative) * pageSize
	used = total - available
	return used, total
}

// parseVMStat 解析 vm_stat 输出
func parseVMStat(output string) map[string]uint64 {
	result := make(map[string]uint64)
	for _, line := range strings.Split(output, "\n") {
		// 第一行: "Mach Virtual Memory Statistics: (page size of 16384 bytes)"
		if strings.Contains(line, "page size of") {
			parts := strings.Fields(line)
			for i, p := range parts {
				if p == "of" && i+1 < len(parts) {
					val, _ := strconv.ParseUint(parts[i+1], 10, 64)
					if val > 0 {
						result["page_size"] = val
					}
					break
				}
			}
			continue
		}
		// 其他行: "Pages free:    123456."
		idx := strings.LastIndex(line, ":")
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		valStr := strings.TrimSpace(line[idx+1:])
		valStr = strings.TrimSuffix(valStr, ".")
		val, err := strconv.ParseUint(valStr, 10, 64)
		if err == nil {
			result[key] = val
		}
	}
	return result
}

// sampleCPU 通过解析 top 命令采样 CPU 使用率
func sampleCPU() float64 {
	out, err := exec.Command("top", "-l", "1", "-n", "0", "-s", "0").Output()
	if err != nil {
		return -1
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "CPU usage:") {
			idle := parsePercentField(line, "idle")
			if idle < 0 {
				return -1
			}
			return 100 - idle
		}
	}
	return -1
}

func parsePercentField(line, field string) float64 {
	parts := strings.Split(line, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.Contains(p, field) {
			fields := strings.Fields(p)
			for _, f := range fields {
				if strings.HasSuffix(f, "%") {
					val, err := strconv.ParseFloat(strings.TrimSuffix(f, "%"), 64)
					if err == nil {
						return val
					}
				}
			}
		}
	}
	return -1
}
