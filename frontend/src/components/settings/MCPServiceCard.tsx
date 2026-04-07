import { motion } from "framer-motion"
import { Plug } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

interface MCPServiceCardProps {
  mcpEnabled: boolean
  onMcpEnabledChange: (enabled: boolean) => void
  mcpPort: number
  onMcpPortChange: (port: number) => void
}

export function MCPServiceCard({ mcpEnabled, onMcpEnabledChange, mcpPort, onMcpPortChange }: MCPServiceCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Plug className="h-4 w-4" /> MCP 服务</CardTitle>
          <CardDescription className="text-xs">Model Context Protocol 服务，允许 AI 助手查询日志数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">启用 MCP 服务</Label>
            <Switch checked={mcpEnabled} onCheckedChange={onMcpEnabledChange} />
          </div>
          {mcpEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">MCP 端口</Label>
              <Input type="number" value={mcpPort} onChange={(e) => onMcpPortChange(parseInt(e.target.value) || 8081)} min={1} max={65535} />
              <p className="text-[10px] text-muted-foreground">SSE 端点: http://localhost:{mcpPort}/sse，修改后需重启生效</p>
              <p className="text-[10px] text-muted-foreground">已设置密码时，MCP 连接需携带 Bearer Token 认证</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
