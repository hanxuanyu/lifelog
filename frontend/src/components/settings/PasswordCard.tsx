import { useState } from "react"
import { motion } from "framer-motion"
import { Lock, Eye, EyeOff, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { setPassword } from "@/api"
import { toast } from "sonner"

export function PasswordCard() {
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error("新密码至少4位"); return }
    setChangingPw(true)
    try {
      await setPassword(oldPassword, newPassword)
      toast.success("密码修改成功")
      setOldPassword(""); setNewPassword("")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "修改失败"
      toast.error("修改失败", { description: msg })
    } finally { setChangingPw(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> 密码管理</CardTitle>
          <CardDescription className="text-xs">设置或修改访问密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange() }} className="space-y-3">
            <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
            <div className="space-y-1.5">
              <Label className="text-xs">旧密码</Label>
              <div className="relative">
                <Input type={showOldPw ? "text" : "password"} value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)} placeholder="首次设置可留空" className="pr-9" autoComplete="current-password" />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowOldPw(!showOldPw)}>
                  {showOldPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">新密码</Label>
              <div className="relative">
                <Input type={showNewPw ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} placeholder="至少4位" className="pr-9" autoComplete="new-password" />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPw(!showNewPw)}>
                  {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="sm" disabled={changingPw || !newPassword} className="w-full">
              <Save className="h-3.5 w-3.5 mr-1" />{changingPw ? "保存中..." : "保存密码"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
