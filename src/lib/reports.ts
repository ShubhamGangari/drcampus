// ==============================================================================
// NAAC/NBA/NIRF Reports module (Module 6) — typed frontend API client.
// Mirrors the FROZEN contract for `/api/reports*` endpoints (docs/specs/
// naac-nba-nirf.md §4). All auth-bearing calls rely on the HttpOnly `auth_token`
// cookie set by the portal login route, so `fetch` here is same-origin.
//
// FROZEN SHAPES (do not deviate):
//   1. `GET /api/reports/naac?academicYear=&schoolId=` → `200 NaacReport`
//   2. `GET /api/reports/nba?programId=&academicYear=&schoolId=` → `200 NbaReport`
//   3. `GET /api/reports/nirf?academicYear=&schoolId=` → `200 NirfReport`
// ==============================================================================

import { toCsv, downloadCsv } from "@/lib/obe";

// ---- Types (shapes the backend returns) --------------------------------------

export interface ReportMetric {
  key: string;
  label: string;
  value: number;
}

export interface NaacReport {
  academicYear: string;
  metrics: ReportMetric[];
}

export interface NbaReport {
  programId: string;
  academicYear: string;
  metrics: ReportMetric[];
}

export interface NirfReport {
  academicYear: string;
  metrics: ReportMetric[];
}

export class ReportsApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ReportsApiError";
    this.status = status;
    this.code = code;
  }
}

async function doFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "GET", headers: { "Content-Type": "application/json" } });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } })?.error;
    throw new ReportsApiError(res.status, err?.message ?? "Unable to load the report.", err?.code);
  }
  return json as T;
}

/** Role gates — only these roles may view reports (spec §2). */
export function canViewReports(role?: string): boolean {
  return role === "SUPER_ADMIN" || role === "REGISTRAR_ADMIN" || role === "DEAN";
}

export function fetchNaacReport(academicYear: string, schoolId?: string) {
  const q = new URLSearchParams({ academicYear });
  if (schoolId) q.set("schoolId", schoolId);
  return doFetch<NaacReport>(`/api/reports/naac?${q.toString()}`);
}

export function fetchNbaReport(programId: string, academicYear: string, schoolId?: string) {
  const q = new URLSearchParams({ programId, academicYear });
  if (schoolId) q.set("schoolId", schoolId);
  return doFetch<NbaReport>(`/api/reports/nba?${q.toString()}`);
}

export function fetchNirfReport(academicYear: string, schoolId?: string) {
  const q = new URLSearchParams({ academicYear });
  if (schoolId) q.set("schoolId", schoolId);
  return doFetch<NirfReport>(`/api/reports/nirf?${q.toString()}`);
}

/** Client-side CSV export of the on-screen metrics (spec §5.2). */
export function exportMetricsCsv(filename: string, metrics: ReportMetric[]) {
  const rows: (string | number)[][] = [["Metric", "Value"]];
  for (const m of metrics) rows.push([m.label, m.value]);
  downloadCsv(filename, toCsv(rows));
}
