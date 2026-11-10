"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/org/OrgShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { useUniversity } from "@/context/UniversityContext";
import {
  DepartmentListItem,
  fetchDepartments,
  fetchStaff,
  OrgApiError,
  POSITION_OPTIONS,
  positionLabel,
  roleLabel,
  StaffMember,
} from "@/lib/org-client";

const ROLE_FILTER_OPTIONS = [
  { value: "REGISTRAR_ADMIN", label: "Registrar Admin" },
  { value: "DEAN", label: "Dean" },
  { value: "FINANCE_OFFICER", label: "Finance Officer" },
  { value: "EXAM_CONTROLLER", label: "Exam Controller" },
  { value: "FACULTY", label: "Faculty" },
];

export default function OrgStaffPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";

  const [schoolId, setSchoolId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");

  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments({})
      .then((d) => setDepartments(d.items ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const staff = await fetchStaff({
        schoolId: isCentral && schoolId ? schoolId : undefined,
        departmentId: departmentId || undefined,
        role: role || undefined,
        position: position || undefined,
      });
      setRows(staff);
    } catch (e) {
      setLoadError(e instanceof OrgApiError ? e.message : "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, departmentId, role, position]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = new Map<string, StaffMember[]>();
  for (const member of rows) {
    const key = member.departmentName ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(member);
  }
  const groupEntries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <PageTitle
        title="Staff directory"
        subtitle="All users grouped by department. Filter by school, department, role or position."
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isCentral && (
          <div className="lg:col-span-1">
            <SchoolSelect value={schoolId} onChange={setSchoolId} />
          </div>
        )}
        <Field label="Department" htmlFor="staff-dept">
          <SelectInput id="staff-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Role" htmlFor="staff-role">
          <SelectInput id="staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_FILTER_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Position" htmlFor="staff-position">
          <SelectInput id="staff-position" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">All positions</option>
            {POSITION_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No staff match your filters"
          description="Try widening your filters or assigning staff to a department."
        />
      ) : (
        <div className="space-y-6">
          {groupEntries.map(([group, members]) => (
            <div key={group} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{group}</h3>
                <span className="text-[11px] font-bold text-slate-500">
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{m.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{m.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {roleLabel(m.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                            {positionLabel(m.position)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
