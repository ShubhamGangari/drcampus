// ==============================================================================
// Cross-cutting infrastructure — client library (audit, notifications, search,
// KPI dashboard). Frontend components import these typed helpers.
//
// Spec: docs/specs/cross-cutting-infra.md §4
// ==============================================================================

import { SendNotificationInput } from './cross-schemas';

export interface AuditLogRow {
    id: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    metadata: string | null;
    createdAt: string;
}

export interface AuditLogFilters {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    q?: string;
    cursor?: string;
    limit?: number;
}

export interface AuditLogResponse {
    logs: AuditLogRow[];
    nextCursor: string | null;
}

export interface NotificationRow {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read: boolean;
    createdAt: string;
}

export interface NotificationsResponse {
    notifications: NotificationRow[];
    nextCursor: string | null;
}

export interface SearchItem {
    id: string;
    label: string;
    href: string | null;
}

export interface SearchResultGroup {
    students: SearchItem[];
    staff: SearchItem[];
    applications: SearchItem[];
    programs: SearchItem[];
    courses: SearchItem[];
    alumni: SearchItem[];
    events: SearchItem[];
    exams: SearchItem[];
}

export type SearchResponse = { results: SearchResultGroup };

export interface Kpis {
    activeStudents: number;
    pendingApplications: number;
    feesCollected: number;
    outstandingDues: number;
    attendanceTodayPercent: number;
    upcomingExams: number;
    facultyCount: number;
    avgCoAttainment: number;
}

export interface TrendPoint {
    label: string;
    value: number;
}

export interface AttendanceTrendPoint {
    label: string;
    present: number;
    absent: number;
}

export interface DashboardTrends {
    feesMonthly: TrendPoint[];
    applicationsMonthly: TrendPoint[];
    attendanceWeekly: AttendanceTrendPoint[];
}

interface ApiErrorBody {
    error: { code: string; message: string };
}

export class CrossApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public code?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'CrossApiError';
    }
}

async function parseError(res: Response): Promise<CrossApiError> {
    let body: ApiErrorBody | null = null;
    try {
        body = (await res.json()) as ApiErrorBody;
    } catch {
        /* non-JSON error body */
    }
    const message = body?.error?.message ?? `Request failed with status ${res.status}`;
    return new CrossApiError(res.status, message, body?.error?.code);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

function qs(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '' && value !== undefined) {
            sp.set(key, String(value));
        }
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const fetchAuditLogs = (filters: AuditLogFilters = {}): Promise<AuditLogResponse> =>
    request<AuditLogResponse>(`/api/audit-logs${qs(filters as Record<string, unknown>)}`);

export const fetchNotifications = (
    opts: { unreadOnly?: boolean; cursor?: string; limit?: number } = {}
): Promise<NotificationsResponse> =>
    request<NotificationsResponse>(`/api/notifications${qs(opts)}`);

export const fetchUnreadCount = (): Promise<{ count: number }> =>
    request<{ count: number }>('/api/notifications/unread-count');

export const markNotificationRead = (id: string): Promise<{ read: boolean }> =>
    request<{ read: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' });

export const markAllNotificationsRead = (): Promise<{ updated: number }> =>
    request<{ updated: number }>('/api/notifications/read-all', { method: 'POST' });

export const sendSystemNotification = (input: SendNotificationInput): Promise<{ id: string }> =>
    request<{ id: string }>('/api/notifications/send', {
        method: 'POST',
        body: JSON.stringify(input),
    });

export const globalSearch = (q: string): Promise<SearchResponse> =>
    request<SearchResponse>(`/api/search${qs({ q })}`);

export const fetchKpis = (): Promise<Kpis> => request<Kpis>('/api/dashboard/kpis');

export const fetchTrends = (): Promise<DashboardTrends> => request<DashboardTrends>('/api/dashboard/trends');
