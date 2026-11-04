import axios from "axios";
import type {
  LoginResponse,
  DashboardResponse,
  House,
  Tenant,
  CreateHouseData,
  CreateTenantData,
  UpdateTenantData,
  ServiceRequest,
  CreateRequestData,
  UpdateRequestData,
  Feedback,
  CreateFeedbackData,
  LeavingNotice,
  CreateNoticeData,
  UpdateNoticeData,
} from "../types";

const TOKEN_KEY = "haven_token";

if (typeof window !== "undefined") {
  localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const response = await api.post<LoginResponse>("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  sessionStorage.setItem(TOKEN_KEY, response.data.access_token);
  return response.data;
}

export async function getUsernameSuggestions(query: string) {
  const response = await api.get<string[]>("/auth/suggestions", {
    params: { q: query },
  });
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data as LoginResponse["user"];
}

export async function getDashboard() {
  const response = await api.get<DashboardResponse>("/dashboard");
  return response.data;
}

export async function getHouses() {
  const response = await api.get<House[]>("/houses");
  return response.data;
}

export async function createHouse(data: CreateHouseData) {
  const response = await api.post<House>("/houses", data);
  return response.data;
}

export async function getTenants() {
  const response = await api.get<Tenant[]>("/tenants");
  return response.data;
}

export async function createTenant(data: CreateTenantData) {
  const response = await api.post<Tenant>("/tenants", data);
  return response.data;
}

export async function updateTenant(tenantId: number, data: UpdateTenantData) {
  const response = await api.patch<Tenant>(`/tenants/${tenantId}`, data);
  return response.data;
}

export async function deleteTenant(tenantId: number) {
  const response = await api.delete(`/tenants/${tenantId}`);
  return response.data;
}

export async function getRequests() {
  const response = await api.get<ServiceRequest[]>("/requests");
  return response.data;
}

export async function createRequest(data: CreateRequestData) {
  const response = await api.post<ServiceRequest>("/requests", data);
  return response.data;
}

export async function updateRequest(
  requestId: number,
  data: UpdateRequestData,
) {
  const response = await api.patch<ServiceRequest>(
    `/requests/${requestId}`,
    data,
  );
  return response.data;
}

export async function getFeedback() {
  const response = await api.get<Feedback[]>("/feedback");
  return response.data;
}

export async function createFeedback(data: CreateFeedbackData) {
  const response = await api.post("/feedback", data);
  return response.data;
}

export async function getNotices() {
  const response = await api.get<LeavingNotice[]>("/notices");
  return response.data;
}

export async function createNotice(data: CreateNoticeData) {
  const response = await api.post("/notices", data);
  return response.data;
}

export async function updateNotice(noticeId: number, data: UpdateNoticeData) {
  const response = await api.patch(`/notices/${noticeId}`, data);
  return response.data;
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg).join(", ");
    }

    return error.message || "Something went wrong.";
  }

  return "Something went wrong.";
}

export default api;
