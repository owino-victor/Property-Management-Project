export type UserRole = "owner" | "caretaker" | "tenant";

export type RequestType = "complaint" | "repair" | "assistance";
export type RequestStatus = "pending" | "in_progress" | "resolved";
export type NoticeStatus =
  | "pending"
  | "acknowledged"
  | "completed"
  | "cancelled";

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DashboardData {
  role: "owner" | "caretaker";
  total_houses: number;
  occupied_houses: number;
  vacant_houses: number;
  active_tenants: number;
  open_requests: number;
  pending_notices: number;
}

export interface TenantDashboardData {
  role: "tenant";
  house: {
    house_number: string;
    description: string | null;
    move_in_date: string;
  };
  requests: {
    total: number;
    open: number;
    resolved: number;
    recent: TenantRequestSummary[];
    upcoming: TenantRequestSummary[];
  };
  feedback_count: number;
  leaving_notice: TenantNoticeSummary | null;
}

export type DashboardResponse = DashboardData | TenantDashboardData;

export interface TenantRequestSummary {
  id: number;
  title: string;
  request_type: RequestType;
  status: RequestStatus;
  caretaker_response: string | null;
  scheduled_for: string | null;
  created_at: string;
}

export interface TenantNoticeSummary {
  id: number;
  intended_departure: string;
  reason: string;
  status: NoticeStatus;
  caretaker_response: string | null;
  created_at: string;
}

export interface House {
  id: number;
  house_number: string;
  description: string | null;
  status: string;
}

export interface Tenant {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  house_id: number;
  house_number: string;
  is_active: boolean;
}

export interface CreateHouseData {
  house_number: string;
  description: string;
}

export interface CreateTenantData {
  full_name: string;
  email: string;
  phone: string;
  house_id: number;
  password: string;
}

export interface UpdateTenantData {
  full_name: string;
  email: string;
  phone: string;
  house_id: number;
}

export interface ServiceRequest {
  id: number;
  tenant_id: number;
  request_type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  caretaker_response: string | null;
  scheduled_for: string | null;
  created_at: string;
}

export interface CreateRequestData {
  request_type: RequestType;
  title: string;
  description: string;
}

export interface UpdateRequestData {
  status: RequestStatus;
  caretaker_response: string | null;
  scheduled_for: string | null;
}

export interface Feedback {
  id: number;
  tenant: string;
  house_number: string;
  message: string;
  created_at: string;
}

export interface CreateFeedbackData {
  message: string;
}

export interface LeavingNotice {
  id: number;
  tenant_id: number;
  tenant: string;
  house_number: string;
  intended_departure: string;
  reason: string;
  status: NoticeStatus;
  caretaker_response: string | null;
  created_at: string;
}

export interface CreateNoticeData {
  intended_departure: string;
  reason: string;
}

export interface UpdateNoticeData {
  status: NoticeStatus;
  caretaker_response: string | null;
}
