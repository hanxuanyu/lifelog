package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/version"
)

// GetVersion 获取版本信息
// @Summary 获取版本信息
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/version [get]
func GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "ok",
		Data: gin.H{
			"version": version.Version,
			"commit":  version.CommitHash,
		},
	})
}

// githubRelease GitHub Release API 响应结构
type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// CheckUpdate 检查是否有新版本
// @Summary 检查是否有新版本
// @Produce json
// @Success 200 {object} model.Response
// @Router /api/check-update [get]
func CheckUpdate(c *gin.Context) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/hanxuanyu/lifelog/releases/latest")
	if err != nil {
		c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: fmt.Sprintf("请求 GitHub API 失败: %v", err),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: fmt.Sprintf("GitHub API 返回 %d", resp.StatusCode),
		})
		return
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		c.JSON(http.StatusOK, model.Response{
			Code:    500,
			Message: fmt.Sprintf("解析响应失败: %v", err),
		})
		return
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	current := strings.TrimPrefix(version.Version, "v")
	hasUpdate := latest != current && version.Version != "dev"

	assets := make([]gin.H, 0, len(release.Assets))
	for _, a := range release.Assets {
		assets = append(assets, gin.H{
			"name":         a.Name,
			"download_url": a.BrowserDownloadURL,
		})
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "ok",
		Data: gin.H{
			"has_update":      hasUpdate,
			"latest_version":  release.TagName,
			"current_version": version.Version,
			"release_url":     release.HTMLURL,
			"assets":          assets,
		},
	})
}
