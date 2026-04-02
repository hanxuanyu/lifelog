import axios from "axios"
import type {
  ApiResponse,
  LogEntry,
  LogEntryRequest,
  PageResult,
  Category,
  DailyStatistics,
  PeriodStatistics,
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
      window.location.reload()
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
  const res = await http.put<ApiResponse>("/auth/password", {
    old_password: oldPassword,
    new_password: newPassword,
  })
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
