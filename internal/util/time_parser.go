package util

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseTime 将多种时间格式统一解析为 HH:mm:ss
// 支持格式: HH:mm, HH:mm:ss, HHmm, HHmmss
func ParseTime(input string) (string, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", fmt.Errorf("时间不能为空")
	}

	var hour, min, sec int
	var err error

	switch {
	case len(input) == 8 && input[2] == ':' && input[5] == ':':
		// HH:mm:ss
		parts := strings.Split(input, ":")
		hour, err = strconv.Atoi(parts[0])
		if err != nil {
			return "", fmt.Errorf("无效的小时: %s", parts[0])
		}
		min, err = strconv.Atoi(parts[1])
		if err != nil {
			return "", fmt.Errorf("无效的分钟: %s", parts[1])
		}
		sec, err = strconv.Atoi(parts[2])
		if err != nil {
			return "", fmt.Errorf("无效的秒: %s", parts[2])
		}

	case len(input) == 5 && input[2] == ':':
		// HH:mm
		parts := strings.Split(input, ":")
		hour, err = strconv.Atoi(parts[0])
		if err != nil {
			return "", fmt.Errorf("无效的小时: %s", parts[0])
		}
		min, err = strconv.Atoi(parts[1])
		if err != nil {
			return "", fmt.Errorf("无效的分钟: %s", parts[1])
		}
		sec = 0

	case len(input) == 4 && isAllDigits(input):
		// HHmm
		hour, _ = strconv.Atoi(input[0:2])
		min, _ = strconv.Atoi(input[2:4])
		sec = 0

	case len(input) == 6 && isAllDigits(input):
		// HHmmss
		hour, _ = strconv.Atoi(input[0:2])
		min, _ = strconv.Atoi(input[2:4])
		sec, _ = strconv.Atoi(input[4:6])

	default:
		return "", fmt.Errorf("不支持的时间格式: %s (支持 HH:mm, HH:mm:ss, HHmm, HHmmss)", input)
	}

	if hour < 0 || hour > 23 {
		return "", fmt.Errorf("小时超出范围(0-23): %d", hour)
	}
	if min < 0 || min > 59 {
		return "", fmt.Errorf("分钟超出范围(0-59): %d", min)
	}
	if sec < 0 || sec > 59 {
		return "", fmt.Errorf("秒超出范围(0-59): %d", sec)
	}

	return fmt.Sprintf("%02d:%02d:%02d", hour, min, sec), nil
}

func isAllDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
