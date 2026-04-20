import { useState, useEffect, useCallback } from "react"
import { Key, Monitor, Smartphone, Copy, Plus, RefreshCw, Trash2, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getTokens, createAPIToken, revokeToken, revokeAllTokens } from "@/api"
import type { TokenInfo } from "@/api"
import { toast } from "sonner"

function getCurrentTokenID(): string {
  try {
    const token = localStorage.getItem("token")
    if (!token) return ""
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return decoded.jti || ""
  } catch {
    return ""
  }
}

function parseUA(ua: string): { device: string; isMobile: boolean } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  let browser = "未知"
  if (/Edg\//i.test(ua)) browser = "Edge"
  else if (/Chrome\//i.test(ua)) browser = "Chrome"
  else if (/Firefox\//i.test(ua)) browser = "Firefox"
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"

  let os = ""
  if (/Windows/i.test(ua)) os = "Windows"
  else if (/Mac OS/i.test(ua)) os = "macOS"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/iPhone|iPad/i.test(ua)) os = "iOS"
  else if (/Linux/i.test(ua)) os = "Linux"

  return { device: os ? `${os} · ${browser}` : browser, isMobile }
}

function formatTime(t: string | null): string {
  if (!t) return "从未"
  const d = new Date(t)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return "刚刚"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function TokenManagementCard() {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [newTokenExpiry, setNewTokenExpiry] = useState("never")
  const [createdToken, setCreatedToken] = useState("")
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const currentTokenID = getCurrentTokenID()

  const fetchTokens = useCallback(async () => {
    try {
      const data = await getTokens()
      setTokens(data || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleRevoke = async (id: string) => {
    setRevoking(id)
    try {
      await revokeToken(id)
      toast.success("令牌已吊销")
      setTokens((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error("吊销失败")
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!confirm("确定要吊销所有其他令牌吗？其他设备将被强制登出。")) return
    try {
      await revokeAllTokens()
      toast.success("已吊销所有其他令牌")
      setTokens((prev) => prev.filter((t) => t.id === currentTokenID))
    } catch {
      toast.error("操作失败")
    }
  }

  const handleCreate = async () => {
    if (!newTokenName.trim()) return
    const expiryMap: Record<string, number | undefined> = {
      never: undefined, "7d": 168, "30d": 720, "90d": 2160, "1y": 8760,
    }
    try {
      const result = await createAPIToken({
        name: newTokenName.trim(),
        expires_in_hours: expiryMap[newTokenExpiry],
      })
      setCreatedToken(result.token)
      fetchTokens()
    } catch {
      toast.error("创建失败")
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(createdToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loginTokens = tokens.filter((t) => t.type === "login")
  const apiTokens = tokens.filter((t) => t.type === "api")

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              令牌管理
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchTokens}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">加载中...</p>
          ) : (
            <>
              {loginTokens.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">登录令牌</p>
                  {loginTokens.map((t) => {
                    const { device, isMobile } = parseUA(t.user_agent)
                    const Icon = isMobile ? Smartphone : Monitor
                    const isCurrent = t.id === currentTokenID
                    return (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {device}
                              {isCurrent && (
                                <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">当前</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.ip} · 最后使用: {formatTime(t.last_used_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          disabled={isCurrent || revoking === t.id}
                          onClick={() => handleRevoke(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {apiTokens.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">API 令牌</p>
                  {apiTokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name || "未命名"}</p>
                        <p className="text-xs text-muted-foreground">
                          最后使用: {formatTime(t.last_used_at)}
                          {t.expires_at && ` · 过期: ${new Date(t.expires_at).toLocaleDateString("zh-CN")}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        disabled={revoking === t.id}
                        onClick={() => handleRevoke(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {tokens.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">暂无令牌</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { setShowCreate(true); setCreatedToken(""); setNewTokenName(""); setNewTokenExpiry("never") }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  创建 API 令牌
                </Button>
                {tokens.length > 1 && (
                  <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={handleRevokeAll}>
                    吊销所有其他
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建 API 令牌</DialogTitle>
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">令牌已创建，请立即复制保存。关闭后将无法再次查看。</p>
              <div className="flex gap-2">
                <Input value={createdToken} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="令牌名称" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} />
              <Select value={newTokenExpiry} onValueChange={setNewTokenExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">永不过期</SelectItem>
                  <SelectItem value="7d">7 天</SelectItem>
                  <SelectItem value="30d">30 天</SelectItem>
                  <SelectItem value="90d">90 天</SelectItem>
                  <SelectItem value="1y">1 年</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            {createdToken ? (
              <Button onClick={() => setShowCreate(false)}>完成</Button>
            ) : (
              <Button onClick={handleCreate} disabled={!newTokenName.trim()}>创建</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
