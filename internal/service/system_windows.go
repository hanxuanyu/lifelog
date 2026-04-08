//go:build windows

package service

import (
	"syscall"
	"time"
	"unsafe"
)

var (
	kernel32              = syscall.NewLazyDLL("kernel32.dll")
	procGetDiskFreeSpace  = kernel32.NewProc("GetDiskFreeSpaceExW")
	procGlobalMemoryStatus = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetSystemTimes    = kernel32.NewProc("GetSystemTimes")
)

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func getDiskUsage(path string) (total, free uint64) {
	pathPtr, _ := syscall.UTF16PtrFromString(path)
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	ret, _, _ := procGetDiskFreeSpace.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&totalFreeBytes)),
	)
	if ret == 0 {
		return 0, 0
	}
	return totalBytes, totalFreeBytes
}

func getOSMemory() (used, total uint64) {
	var ms memoryStatusEx
	ms.Length = uint32(unsafe.Sizeof(ms))
	ret, _, _ := procGlobalMemoryStatus.Call(uintptr(unsafe.Pointer(&ms)))
	if ret == 0 {
		return 0, 0
	}
	return ms.TotalPhys - ms.AvailPhys, ms.TotalPhys
}

type filetime struct {
	LowDateTime  uint32
	HighDateTime uint32
}

func filetimeToUint64(ft filetime) uint64 {
	return uint64(ft.HighDateTime)<<32 | uint64(ft.LowDateTime)
}

// sampleCPU 通过 GetSystemTimes 采样 CPU 使用率
func sampleCPU() float64 {
	var idle1, kernel1, user1 filetime
	ret, _, _ := procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idle1)),
		uintptr(unsafe.Pointer(&kernel1)),
		uintptr(unsafe.Pointer(&user1)),
	)
	if ret == 0 {
		return -1
	}

	time.Sleep(500 * time.Millisecond)

	var idle2, kernel2, user2 filetime
	ret, _, _ = procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idle2)),
		uintptr(unsafe.Pointer(&kernel2)),
		uintptr(unsafe.Pointer(&user2)),
	)
	if ret == 0 {
		return -1
	}

	idleDelta := filetimeToUint64(idle2) - filetimeToUint64(idle1)
	kernelDelta := filetimeToUint64(kernel2) - filetimeToUint64(kernel1)
	userDelta := filetimeToUint64(user2) - filetimeToUint64(user1)

	totalDelta := kernelDelta + userDelta
	if totalDelta == 0 {
		return 0
	}
	// kernel time includes idle time
	return float64(totalDelta-idleDelta) / float64(totalDelta) * 100
}
