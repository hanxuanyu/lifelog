import { motion } from "framer-motion"
import { Server } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface ServerConfigCardProps {
  serverPort: number
  onServerPortChange: (port: number) => void
  dbPath: string
  onDbPathChange: (path: string) => void
}

export function ServerConfigCard({ serverPort, onServerPortChange, dbPath, onDbPathChange }: ServerConfigCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> 服务器配置</CardTitle>
          <CardDescription className="text-xs">修改后需要重启服务才能生效</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">端口</Label>
            <Input type="number" value={serverPort} onChange={(e) => onServerPortChange(parseInt(e.target.value) || 8080)} min={1} max={65535} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">数据库路径</Label>
            <Input value={dbPath} onChange={(e) => onDbPathChange(e.target.value)} placeholder="./data/lifelog.db" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
