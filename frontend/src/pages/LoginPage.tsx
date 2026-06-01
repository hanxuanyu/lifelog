import React, { useState } from "react"
import { motion } from "framer-motion"
import { Lock, Eye, EyeOff } from "lucide-react"
import { isAxiosError } from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { login } from "@/api"
import { toast } from "sonner"

interface LoginPageProps {
  onLogin: (token: string) => void
}

function getLoginErrorDescription(err: unknown) {
  if (!isAxiosError(err)) {
    return "登录请求处理失败，请稍后重试"
  }

  if (!err.response) {
    if (err.code === "ECONNABORTED") {
      return "连接后端服务超时，请稍后重试"
    }
    return "后端服务暂不可用，请确认服务已启动或稍后重试"
  }

  const status = err.response.status
  const message = (err.response.data as { message?: string } | undefined)?.message

  if (status === 401) {
    return message || "密码错误"
  }
  if (status === 400) {
    return message || "登录参数有误，请检查后重试"
  }
  if (status === 404) {
    return "登录接口暂不可用，请确认后端服务版本和路由配置"
  }
  if (status === 502 || status === 503 || status === 504) {
    return "后端服务暂不可用，请稍后重试"
  }
  if (status >= 500) {
    return message || "后端服务异常，请稍后重试"
  }

  return message || `登录请求失败 (${status})`
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      const data = await login(password)
      localStorage.setItem("token", data.token)
      onLogin(data.token)
    } catch (err) {
      toast.error("登录失败", { description: getLoginErrorDescription(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
            >
              <Lock className="h-6 w-6 text-primary" />
            </motion.div>
            <CardTitle className="text-xl">Lifelog</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="pr-9"
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
