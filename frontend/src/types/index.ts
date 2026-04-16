export interface LogEntry {
  id: number
  log_date: string
  log_time: string
  time_range?: string
  event_type: string
  detail: string
  category: string
  time_point_mode?: string
  created_at: string
  updated_at: string
}

export interface LogEntryRequest {
  log_date?: string
  log_time: string
  event_type: string
  detail?: string
}

export interface Category {
  name: string
  color: string
  rules: CategoryRule[]
}

export interface CategoryRule {
  type: "fixed" | "regex"
  pattern: string
}

export interface DurationItem {
  event_type: string
  category: string
  duration: number
  display: string
  unknown: boolean
  cross_day?: boolean
  start_time: string
  end_time: string
  time_point_mode?: string
}

export interface CategorySummary {
  category: string
  duration: number
  display: string
  percentage: number
}

export interface CrossDayHint {
  event_type: string
  category: string
  start_time: string
  end_time: string
  direction: "prev" | "next"
}

export interface DailyStatistics {
  date: string
  items: DurationItem[]
  summary: CategorySummary[]
  total_known: string
  time_point_mode: string
  cross_day_hints?: CrossDayHint[]
  prev_day_last_time?: string
}

export interface PeriodStatistics {
  start_date: string
  end_date: string
  summary: CategorySummary[]
  total_known: string
  day_count: number
  items?: DurationItem[]
}

export interface DayBreakdown {
  date: string
  summary: CategorySummary[]
  total_known: number
}

export interface TrendStatistics {
  start_date: string
  end_date: string
  days: DayBreakdown[]
}

export interface PageResult<T> {
  total: number
  page: number
  size: number
  items: T[]
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface Settings {
  time_point_mode: string
  server: {
    port: number
    db_path: string
  }
  auth: {
    jwt_expire_hours: number
  }
  mcp: {
    enabled: boolean
    port: number
  }
}

export interface UpdateSettingsRequest {
  time_point_mode?: string
  server_port?: number
  server_db_path?: string
  jwt_expire_hours?: number
  mcp_enabled?: boolean
  mcp_port?: number
}

export interface UpdateSettingsResponse {
  need_restart: boolean
}

export type ImportConfigType = "basic" | "auth" | "ai" | "categories" | "webhooks" | "scheduled_tasks"

export interface ImportDataResult {
  logs_imported?: number
  logs_skipped?: number
  logs_total?: number
  config_imported?: boolean
  config_imported_types?: ImportConfigType[]
  config_need_restart?: boolean
  config_error?: string
  config_errors?: string[]
}

export interface AIProvider {
  name: string
  endpoint: string
  api_key: string
  model: string
  default: boolean
}

export interface AIChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface AIChatRequest {
  provider_name?: string
  model?: string
  start_date: string
  end_date: string
  message: string
  history: AIChatMessage[]
  system_prompt?: string
  categories?: string[]
}

export interface Webhook {
  name: string
  url: string
  method: string
  headers: Record<string, string>
  query_params: Record<string, string>
  body: string
  timeout_seconds: number
}

export interface EventBinding {
  event: string
  webhook_name: string
  enabled: boolean
}

export interface EventVariable {
  key: string
  description: string
}

export interface EventDefinition {
  name: string
  description: string
  variables: EventVariable[]
}

export interface ScheduledTaskInfo {
  name: string
  description: string
  cron: string
  enabled: boolean
  event_name: string
  event_names?: string[]
  default_cron: string
  next_run?: string
  bound_webhook_count: number
  param_definitions?: ScheduledTaskParamDefinition[]
}

export interface ScheduledTaskUpdate {
  name: string
  cron: string
  enabled: boolean
  params?: Record<string, string>
}

export interface ScheduledTaskParamDefinition {
  key: string
  label: string
  description?: string
  type: "text" | "textarea" | "boolean"
  placeholder?: string
  read_only?: boolean
  value?: string
  rows?: number
}

export interface SystemMonitor {
  cpu_usage: number
  cpu_cores: number
  os_mem_used: number
  os_mem_total: number
  os_mem_percent: number
  go_mem_alloc: number
  go_mem_sys: number
  go_mem_gc_sys: number
  go_gc_count: number
  go_gc_pause_ms: number
  goroutines: number
  go_version: string
  disk_used: number
  disk_total: number
  disk_percent: number
  uptime_seconds: number
  directories: DirInfo[]
}

export interface DirInfo {
  label: string
  path: string
  size_bytes: number
  file_count: number
  exists: boolean
}
