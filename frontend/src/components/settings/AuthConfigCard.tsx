import { motion } from "framer-motion"
import { Shield } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AuthConfigCardProps {
  jwtExpireHours: number
  onJwtExpireHoursChange: (hours: number) => void
}

export function AuthConfigCard({ jwtExpireHours, onJwtExpireHoursChange }: AuthConfigCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> 认证配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">JWT 过期时间（小时）</Label>
            <Input type="number" value={jwtExpireHours} onChange={(e) => onJwtExpireHoursChange(parseInt(e.target.value) || 168)} min={1} />
            <p className="text-[10px] text-muted-foreground">修改后需要重启生效，当前约 {Math.round(jwtExpireHours / 24)} 天</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
