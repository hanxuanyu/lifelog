import axios from "axios"
import type {
  ApiResponse,
  LogEntry,
  LogEntryRequest,
  PageResult,
  Category,
  DailyStatistics,
  PeriodStatistics,
  TrendStatistics,
  Settings,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from "@/types"

const http = axios.create({
  baseURL: "/api",
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
    }
    return Promise.reject(err)
  }
)

// Auth
export async function login(password: string) {
  const res = await http.post<ApiResponse<{ token: string }>>("/auth/login", { password })
  return res.data.data
}

export async function setPassword(oldPassword: string, newPassword: string) {
  const res = await http.put<ApiResponse<{ token?: string }>>("/auth/password", {
    old_password: oldPassword,
    new_password: newPassword,
  })
  if (res.data.data?.token) {
    localStorage.setItem("token", res.data.data.token)
  }
  return res.data
}

// Logs
export async function createLog(data: LogEntryRequest) {
  const res = await http.post<ApiResponse<LogEntry>>("/logs", data)
  return res.data.data
}

export async function getLogs(params: {
  date?: string
  event_type?: string
  category?: string
  keyword?: string
  page?: number
  size?: number
}) {
  const res = await http.get<ApiResponse<PageResult<LogEntry>>>("/logs", { params })
  return res.data.data
}

export async function getTimeline(date: string) {
  const res = await http.get<ApiResponse<LogEntry[]>>("/logs/timeline", {
    params: { date },
  })
  return res.data.data
}

export async function getLog(id: number) {
  const res = await http.get<ApiResponse<LogEntry>>(`/logs/${id}`)
  return res.data.data
}

export async function updateLog(id: number, data: LogEntryRequest) {
  const res = await http.put<ApiResponse<LogEntry>>(`/logs/${id}`, data)
  return res.data.data
}

export async function deleteLog(id: number) {
  const res = await http.delete<ApiResponse>(`/logs/${id}`)
  return res.data
}

// Event Types
export async function getEventTypes() {
  const res = await http.get<ApiResponse<string[]>>("/logs/event-types")
  return res.data.data
}

// Categories
export async function getCategories() {
  const res = await http.get<ApiResponse<Category[]>>("/categories")
  return res.data.data
}

export async function updateCategories(categories: Category[]) {
  const res = await http.put<ApiResponse>("/categories", categories)
  return res.data
}

// Settings
export async function getSettings() {
  const res = await http.get<ApiResponse<Settings>>("/settings")
  return res.data.data
}

export async function updateSettings(data: UpdateSettingsRequest) {
  const res = await http.put<ApiResponse<UpdateSettingsResponse>>("/settings", data)
  return res.data
}

// Statistics
export async function getDailyStats(date: string) {
  const res = await http.get<ApiResponse<DailyStatistics>>("/statistics/daily", {
    params: { date },
  })
  return res.data.data
}

export async function getWeeklyStats(date: string) {
  const res = await http.get<ApiResponse<PeriodStatistics>>("/statistics/weekly", {
    params: { date },
  })
  return res.data.data
}

export async function getMonthlyStats(year: number, month: number) {
  const res = await http.get<ApiResponse<PeriodStatistics>>("/statistics/monthly", {
    params: { year, month },
  })
  return res.data.data
}

export async function getTrendStats(startDate: string, endDate: string) {
  const res = await http.get<ApiResponse<TrendStatistics>>("/statistics/trend", {
    params: { start_date: startDate, end_date: endDate },
  })
  return res.data.data
}

// Data Export/Import
export async function exportData() {
  const res = await http.get("/data/export", { responseType: "blob" })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement("a")
  a.href = url
  const disposition = res.headers["content-disposition"]
  const match = disposition?.match(/filename=(.+)/)
  a.download = match ? match[1] : "lifelog-export.zip"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importData(file: File, mergeLogs: boolean, importConfig: boolean) {
  const form = new FormData()
  form.append("file", file)
  form.append("merge_logs", String(mergeLogs))
  form.append("import_config", String(importConfig))
  const res = await http.post<ApiResponse<{
    logs_imported?: number
    logs_skipped?: number
    logs_total?: number
    config_imported?: boolean
    config_error?: string
  }>>("/data/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  })
  return res.data
}
