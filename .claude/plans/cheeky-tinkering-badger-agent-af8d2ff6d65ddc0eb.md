# AI Integration Implementation Plan for Lifelog

## Overview

Add three AI features to Lifelog: (1) AI provider settings management, (2) AI-powered log summary chat in Statistics page, (3) MCP server for external AI tool access. All AI providers use OpenAI-compatible `/v1/chat/completions` API format.

---

## 1. Config Changes

### 1.1 New YAML Structure in `config.yaml`

Add an `ai` top-level key alongside existing `server`, `auth`, `categories`, `time_point_mode`:

```yaml
ai:
  default_provider: ""
  providers:
    - id: "openai-1"
      name: "OpenAI"
      endpoint: "https://api.openai.com/v1"
      api_key: "sk-..."
      model: "gpt-4o"
    - id: "ollama-1"
      name: "Local Ollama"
      endpoint: "http://localhost:11434/v1"
      api_key: ""
      model: "llama3"
  mcp:
    enabled: false
    port: 8081
```

### 1.2 New Model Struct

File: `internal/model/ai.go`

```go
package model

// AIProvider AI 服务提供商配置
type AIProvider struct {
    ID       string `yaml:"id" json:"id"`
    Name     string `yaml:"name" json:"name"`
    Endpoint string `yaml:"endpoint" json:"endpoint"`
    APIKey   string `yaml:"api_key" json:"api_key"`
    Model    string `yaml:"model" json:"model"`
}

// AIChatRequest AI 对话请求
type AIChatRequest struct {
    Message   string `json:"message" binding:"required"`
    StartDate string `json:"start_date" binding:"required"`
    EndDate   string `json:"end_date" binding:"required"`
}

// AIChatMessage OpenAI-compatible message
type AIChatMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}
```

### 1.3 New Config Accessor Functions

File: `internal/config/config.go` (append to existing)

Following the existing pattern of `GetXxx()` / `SetXxx()` with `viper.GetXxx` / `viper.Set` + `viper.WriteConfig()`:

```go
// Add aiProviders to existing var block, guarded by existing mu
var aiProviders []model.AIProvider

// loadAIProviders called from OnConfigChange alongside loadCategories
func loadAIProviders()

// GetAIProviders 获取 AI 提供商列表（并发安全）
func GetAIProviders() []model.AIProvider

// GetDefaultAIProvider 获取默认 AI 提供商
func GetDefaultAIProvider() *model.AIProvider

// GetDefaultProviderID 获取默认提供商 ID
func GetDefaultProviderID() string

// SetAIProviders 设置 AI 提供商列表并写入配置文件
func SetAIProviders(providers []model.AIProvider) error

// SetDefaultProviderID 设置默认提供商 ID
func SetDefaultProviderID(id string) error

// GetMCPEnabled 获取 MCP 是否启用
func GetMCPEnabled() bool

// GetMCPPort 获取 MCP 端口
func GetMCPPort() int

// SetMCPConfig 设置 MCP 配置
func SetMCPConfig(enabled bool, port int) error
```

The `OnConfigChange` callback should be extended to also call `loadAIProviders()`.

Extend `defaultConfigYAML` with:
```yaml
ai:
  default_provider: ""
  providers: []
  mcp:
    enabled: false
    port: 8081
```

---

## 2. Backend AI Service

### 2.1 AI Service

File: `internal/service/ai.go`

```go
package service

// BuildLogContext 构建日期范围内的日志上下文文本
// Queries repository.GetEntriesByDateRange, formats entries into structured
// text suitable for AI consumption.
func BuildLogContext(startDate, endDate string) (string, error)

// TestAIProvider 测试 AI 提供商连接
// Sends a minimal request to the provider endpoint, returns nil on success.
func TestAIProvider(provider model.AIProvider) error

// StreamAIChat 流式调用 AI 对话
// Calls POST {endpoint}/chat/completions with stream:true.
// Writes SSE chunks to gin.Context writer.
func StreamAIChat(c *gin.Context, provider model.AIProvider, logContext string, userMessage string) error
```

**BuildLogContext format:**
```
=== 活动记录 (2024-01-01 ~ 2024-01-07) ===

2024-01-01:
  08:00 [工作] 编程
  09:30 [工作] 开会
  12:00 [吃喝] 午饭

2024-01-02:
  ...

=== 统计摘要 ===
工作: 35h20m (45.2%)
成长: 10h15m (13.1%)
...
总记录时长: 78h10m
```

Reuses `repository.GetEntriesByDateRange` and `service.MatchCategory`.

**StreamAIChat implementation details:**

1. Build messages array:
   - System: "你是一个生活日志分析助手。以下是用户在指定时间范围内的活动记录数据，请根据这些数据回答用户的问题。\n\n{logContext}"
   - User: the user's question

2. POST to `{provider.Endpoint}/chat/completions`:
   ```json
   { "model": "{provider.Model}", "messages": [...], "stream": true }
   ```
   Headers: `Authorization: Bearer {provider.APIKey}`, `Content-Type: application/json`

3. Read response body line by line. For each `data: {...}` line, parse delta content and forward as SSE:
   ```
   data: {"content": "chunk text"}
   ```
   On `data: [DONE]`, send `data: [DONE]`.

4. Response headers before streaming:
   ```
   Content-Type: text/event-stream
   Cache-Control: no-cache
   Connection: keep-alive
   ```

5. Use `c.Writer.Write()` + `c.Writer.Flush()` for SSE output.

6. Use `net/http` client with 120s timeout for upstream request.

---

## 3. Backend Handlers & Routes

### 3.1 AI Handler

File: `internal/handler/ai.go`

Following existing handler pattern (parse params -> call service -> return model.Response):

```go
// GetAIProviders GET /api/ai/providers
// Returns providers with api_key masked (last 4 chars only)
func GetAIProviders(c *gin.Context)

// AddAIProvider POST /api/ai/providers
// Body: AIProvider (id auto-generated if empty)
func AddAIProvider(c *gin.Context)

// UpdateAIProvider PUT /api/ai/providers/:id
func UpdateAIProvider(c *gin.Context)

// DeleteAIProvider DELETE /api/ai/providers/:id
func DeleteAIProvider(c *gin.Context)

// TestAIProvider POST /api/ai/providers/test
// Body: full AIProvider config including api_key
func TestAIProvider(c *gin.Context)

// SetDefaultProvider PUT /api/ai/default
// Body: { "id": "provider-id" }
func SetDefaultProvider(c *gin.Context)

// GetDefaultProvider GET /api/ai/default
func GetDefaultProvider(c *gin.Context)

// ChatStream POST /api/ai/chat
// Body: AIChatRequest; Response: SSE stream
func ChatStream(c *gin.Context)
```

**ChatStream flow:**
1. Parse `AIChatRequest`
2. Get default provider via `config.GetDefaultAIProvider()`; 400 if none
3. `service.BuildLogContext(req.StartDate, req.EndDate)`
4. `service.StreamAIChat(c, provider, logContext, req.Message)`

### 3.2 Route Registration

File: `internal/router/router.go` (modify)

Add inside `protected` group:

```go
// AI
ai := protected.Group("/ai")
{
    ai.GET("/providers", handler.GetAIProviders)
    ai.POST("/providers", handler.AddAIProvider)
    ai.PUT("/providers/:id", handler.UpdateAIProvider)
    ai.DELETE("/providers/:id", handler.DeleteAIProvider)
    ai.POST("/providers/test", handler.TestAIProvider)
    ai.GET("/default", handler.GetDefaultProvider)
    ai.PUT("/default", handler.SetDefaultProvider)
    ai.POST("/chat", handler.ChatStream)
}
```

---

## 4. MCP Server

### 4.1 Implementation

File: `internal/mcp/server.go`

Uses `github.com/mark3labs/mcp-go` library (SSE transport, separate port).

```go
package mcp

// StartMCPServer 启动 MCP 服务器（SSE 传输）
// Called from main.go if config.GetMCPEnabled() is true.
func StartMCPServer(port int) error
```

### 4.2 MCP Tools

1. **query_logs** - Query log entries with filters
   - Params: `start_date`, `end_date`, `event_type` (optional), `keyword` (optional)
   - Returns: formatted log entries

2. **get_statistics** - Get statistics summary for a period
   - Params: `start_date`, `end_date`
   - Returns: category summary with durations and percentages

3. **get_categories** - Get all configured categories
   - Params: none
   - Returns: category list

4. **get_event_types** - Get all distinct event types
   - Params: none
   - Returns: event type strings

Each tool handler reuses existing repository/service functions directly.

### 4.3 Startup in main.go

File: `main.go` (modify)

```go
if config.GetMCPEnabled() {
    go func() {
        mcpPort := config.GetMCPPort()
        slog.Info("MCP 服务启动", "port", mcpPort)
        if err := mcp.StartMCPServer(mcpPort); err != nil {
            slog.Error("MCP 服务启动失败", "error", err)
        }
    }()
}
```

---

## 5. Frontend Types

File: `frontend/src/types/index.ts` (append)

```typescript
export interface AIProvider {
  id: string
  name: string
  endpoint: string
  api_key: string
  model: string
}

export interface AIChatRequest {
  message: string
  start_date: string
  end_date: string
}

export interface AIChatMessage {
  role: "user" | "assistant"
  content: string
}
```

---

## 6. Frontend API

File: `frontend/src/api/index.ts` (append)

```typescript
// AI Providers
export async function getAIProviders(): Promise<AIProvider[]>
export async function addAIProvider(provider: Omit<AIProvider, "id">): Promise<AIProvider>
export async function updateAIProvider(id: string, provider: Partial<AIProvider>): Promise<void>
export async function deleteAIProvider(id: string): Promise<void>
export async function testAIProvider(provider: AIProvider): Promise<ApiResponse>
export async function getDefaultProvider(): Promise<AIProvider | null>
export async function setDefaultProvider(id: string): Promise<void>

// AI Chat (SSE streaming via fetch, not axios)
export function streamAIChat(
  req: AIChatRequest,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController
```

The `streamAIChat` function uses `fetch` + `ReadableStream` (not EventSource, since POST with body is needed). Returns an `AbortController` for cancellation support.

Key implementation: read response body as stream, split by newlines, parse `data: {...}` lines, extract `content` field from each chunk, call `onChunk`. On `data: [DONE]`, call `onDone`.

---

## 7. Frontend Settings: AI Provider Management

### 7.1 New Component

File: `frontend/src/components/settings/AIProviderSettings.tsx` (new)

Extracted as a self-contained component to keep SettingsPage manageable.

**UI Design** — a Card following existing SettingsPage patterns:

- Header: `Bot` icon (lucide-react) + "AI 服务配置" + description
- Provider list: each provider as a bordered section with:
  - Name (Input)
  - API Endpoint (Input)
  - API Key (password Input with show/hide toggle, same pattern as password card)
  - Model name (Input)
  - "测试连接" button (calls testAIProvider, toast on result)
  - "设为默认" radio/button (highlighted if default)
  - Delete button (Trash2 icon)
- "添加提供商" button (Plus icon)
- Save button with AnimatePresence (appears when dirty, same pattern as categories save)

**Component state:**
```typescript
const [providers, setProviders] = useState<AIProvider[]>([])
const [defaultId, setDefaultId] = useState("")
const [origProviders, setOrigProviders] = useState<AIProvider[]>([])
const [testing, setTesting] = useState<Record<string, boolean>>({})
```

### 7.2 Integration into SettingsPage

File: `frontend/src/pages/SettingsPage.tsx` (modify)

- Import `AIProviderSettings`
- Add as new `<motion.div>` in left column after "数据管理" card
- Uses same delay animation pattern: `transition={{ delay: 0.35 }}`

---

## 8. Frontend Statistics: AI Summary Tab

### 8.1 New Tab

File: `frontend/src/pages/StatisticsPage.tsx` (modify)

Add 5th tab:
```tsx
<TabsTrigger value="ai" className="flex-1">AI 总结</TabsTrigger>
```

Add content:
```tsx
<TabsContent value="ai" className="mt-0">
  <AISummaryChat />
</TabsContent>
```

### 8.2 AISummaryChat Component

File: `frontend/src/components/statistics/AISummaryChat.tsx` (new)

**Layout:**
```
┌─────────────────────────────────────┐
│  Date Range: [start] ~ [end]        │
├─────────────────────────────────────┤
│  Chat Messages (ScrollArea)         │
│                                     │
│  ┌─ User ────────────────────┐      │
│  │ 这周工作时间分布如何？      │      │
│  └───────────────────────────┘      │
│  ┌─ AI ──────────────────────┐      │
│  │ 根据您本周的记录...         │      │
│  │ (markdown rendered)        │      │
│  └───────────────────────────┘      │
├─────────────────────────────────────┤
│  [Message input...       ] [Send]   │
└─────────────────────────────────────┘
```

**State:**
```typescript
const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"))
const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
const [messages, setMessages] = useState<AIChatMessage[]>([])
const [input, setInput] = useState("")
const [streaming, setStreaming] = useState(false)
const [abortController, setAbortController] = useState<AbortController | null>(null)
const scrollRef = useRef<HTMLDivElement>(null)
```

**Behavior:**
1. User selects date range, types question, clicks Send (or Enter)
2. User message appended to `messages`
3. Empty assistant message appended
4. `streamAIChat` called; each `onChunk` appends to last assistant message
5. Auto-scroll to bottom on each chunk
6. "Stop" button during streaming (calls `abortController.abort()`)
7. If no default provider configured, show hint linking to Settings

**Quick question chips** (shown when chat is empty):
- "总结一下这段时间的活动"
- "我的时间分配合理吗？"
- "哪些活动占用时间最多？"
- "给我一些时间管理建议"

**Markdown rendering:** reuse existing `MarkdownRenderer` component.

---

## 9. Complete File List

### New Files (6)

| File | Description |
|------|-------------|
| `internal/model/ai.go` | AIProvider, AIChatRequest, AIChatMessage structs |
| `internal/service/ai.go` | BuildLogContext, TestAIProvider, StreamAIChat |
| `internal/handler/ai.go` | All AI HTTP handlers |
| `internal/mcp/server.go` | MCP server with SSE transport and tool definitions |
| `frontend/src/components/settings/AIProviderSettings.tsx` | AI provider management Card |
| `frontend/src/components/statistics/AISummaryChat.tsx` | AI chat interface |

### Modified Files (9)

| File | Changes |
|------|---------|
| `config.yaml` | Add `ai` section |
| `internal/config/config.go` | Add aiProviders var, loadAIProviders(), Get/Set AI+MCP functions, extend OnConfigChange and defaultConfigYAML |
| `internal/router/router.go` | Add `/api/ai/*` route group |
| `main.go` | Add conditional MCP server startup |
| `go.mod` / `go.sum` | Add `github.com/mark3labs/mcp-go` |
| `frontend/src/types/index.ts` | Add AIProvider, AIChatRequest, AIChatMessage |
| `frontend/src/api/index.ts` | Add AI provider CRUD + streamAIChat SSE |
| `frontend/src/pages/SettingsPage.tsx` | Import and render AIProviderSettings |
| `frontend/src/pages/StatisticsPage.tsx` | Add "AI 总结" tab with AISummaryChat |

---

## 10. Implementation Sequence

**Phase 1: Backend Foundation**
1. `internal/model/ai.go` — data structures
2. `internal/config/config.go` — AI config accessors, hot reload
3. `config.yaml` — add `ai` section to default

**Phase 2: Backend AI Service & Handlers**
4. `internal/service/ai.go` — context building, streaming, test
5. `internal/handler/ai.go` — all endpoints
6. `internal/router/router.go` — register routes

**Phase 3: Frontend AI Provider Settings**
7. `frontend/src/types/index.ts` — new interfaces
8. `frontend/src/api/index.ts` — new API functions
9. `frontend/src/components/settings/AIProviderSettings.tsx` — new component
10. `frontend/src/pages/SettingsPage.tsx` — integrate

**Phase 4: Frontend AI Chat**
11. `frontend/src/components/statistics/AISummaryChat.tsx` — new component
12. `frontend/src/pages/StatisticsPage.tsx` — add tab

**Phase 5: MCP Server**
13. `go.mod` — add mcp-go dependency
14. `internal/mcp/server.go` — MCP implementation
15. `main.go` — conditional startup

---

## 11. Design Decisions

1. **Config in YAML, not DB** — consistent with categories/auth pattern. Hot reload via Viper WatchConfig.
2. **Single OpenAI-compatible format** — no provider-specific adapters needed.
3. **SSE for chat streaming** — backend proxies AI provider SSE to frontend. Frontend uses fetch+ReadableStream (not EventSource, since POST body needed).
4. **API key security** — stored server-side in config.yaml. GET endpoint masks keys. Test endpoint accepts full key in body.
5. **MCP on separate port** — avoids route conflicts with Gin. Uses SSE transport from mcp-go.
6. **No chat persistence** — messages live in React state only. Keeps implementation simple.
7. **Context window management** — for large date ranges, BuildLogContext may need truncation. Can be a follow-up optimization.
