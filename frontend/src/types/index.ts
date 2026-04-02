export interface LogEntry {
  id: number
  log_date: string
  log_time: string
  event_type: string
  detail: string
  category: string
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
  start_time: string
  end_time: string
}

export interface CategorySummary {
  category: string
  duration: number
  display: string
  percentage: number
}

export interface DailyStatistics {
  date: string
  items: DurationItem[]
  summary: CategorySummary[]
  total_known: string
  time_point_mode: string
}

export interface PeriodStatistics {
  start_date: string
  end_date: string
  summary: CategorySummary[]
  total_known: string
  day_count: number
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
}

export interface UpdateSettingsRequest {
  time_point_mode?: string
  server_port?: number
  server_db_path?: string
  jwt_expire_hours?: number
}

export interface UpdateSettingsResponse {
  need_restart: boolean
}
