package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hxuanyu/lifelog/internal/model"
	"github.com/hxuanyu/lifelog/internal/service"
)

// Login 登录
// @Summary 密码登录
// @Tags 认证
// @Accept json
// @Produce json
// @Param body body model.LoginRequest true "登录信息"
// @Success 200 {object} model.Response{data=model.LoginResponse}
// @Failure 400,401 {object} model.Response
// @Router /api/auth/login [post]
func Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Warn("登录参数错误", "error", err, "ip", c.ClientIP())
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	token, err := service.Login(req.Password)
	if err != nil {
		slog.Warn("登录失败", "error", err, "ip", c.ClientIP())
		c.JSON(http.StatusUnauthorized, model.Response{Code: 401, Message: err.Error()})
		return
	}

	slog.Info("登录成功", "ip", c.ClientIP())
	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "登录成功",
		Data:    model.LoginResponse{Token: token},
	})
}

// SetPassword 设置/修改密码
// @Summary 设置或修改密码
// @Tags 认证
// @Accept json
// @Produce json
// @Param body body model.PasswordRequest true "密码信息"
// @Success 200 {object} model.Response
// @Failure 400 {object} model.Response
// @Router /api/auth/password [put]
func SetPassword(c *gin.Context) {
	var req model.PasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	token, err := service.SetPasswordAndLogin(req.OldPassword, req.NewPassword)
	if err != nil {
		slog.Warn("密码修改失败", "error", err, "ip", c.ClientIP())
		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Message: err.Error()})
		return
	}

	slog.Info("密码修改成功", "ip", c.ClientIP())
	c.JSON(http.StatusOK, model.Response{
		Code:    200,
		Message: "密码设置成功",
		Data:    model.LoginResponse{Token: token},
	})
}
