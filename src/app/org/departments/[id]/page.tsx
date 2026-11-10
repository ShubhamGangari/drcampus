"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Crown, Pencil, ArrowRightLeft, Plus } from "lucide-react";
import { PageTitle } from "@/components/org/OrgShell";
import { SetHeadModal } from "@/components/org/SetHeadModal";
import { MemberActionModal } from "@/components/org/MemberActionModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { useUniversity } from "@/context/UniversityContext";
import {
  canAssignStaff,
  canManageDepartments,
  assignUserDepartment,
  DepartmentDetail,
  DepartmentListItem,
  fetchDepartment,
  fetchDepartments,
  fetchStaff,
  OrgApiError,
  positionLabel,
  roleLabel,
  setDepartmentHead,
  setUserPosition,
  StaffMember,
} from "@/lib/org-client";

export default function OrgDepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useUniversity();
  const canManage = canManageDepartments(currentUser);
  const canAssign = canAssignStaff(currentUser?.role);

  const [dept, setDept] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [headOpen, setHeadOpen] = useState(false);
  const [headCandidates, setHeadCandidates] = useState<StaffMember[]>([]);

  const [memberTarget, setMemberTarget] = useState<StaffMember | null>(null);
  const [memberMode, setMemberMode] = useState<"position" | "move">("position");
  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDepartment(id);
      setDept(data);
    } catch (e) {
      setLoadError(e instanceof OrgApiError ? e.message : "Unable to load department.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadHeadCandidates = async () => {
    try {
      const staff = await fetchStaff({ departmentId: id });
      const eligible = staff.filter((s) => s.role === "DEAN" || s.position === "HOD");
      setHeadCandidates(eligible);
    } catch {
      setHeadCandidates([]);
    }
  };

  const openSetHead = () => {
    setSubmitError(null);
    setHeadOpen(true);
    void loadHeadCandidates();
  };

  const openMemberAction = (member: StaffMember, mode: "position" | "move") => {
    setSubmitError(null);
    setMemberTarget(member);
    setMemberMode(mode);
    if (mode === "move") {
      fetchDepartments({})
        .then((d) => setDepartments(d.items ?? []))
        .catch(() => setDepartments([]));
    }
  };

  const handleSetHead = async (headUserId: string | null) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await setDepartmentHead(id, { headUserId });
      setHeadOpen(false);
      setToast({ message: "Department head updated.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not set department head.");
    } finally {
      setBusy(false);
    }
  };

  const handleMemberAction = async (payload: { position?: string; departmentId?: string }) => {
    if (!memberTarget) return;
    setBusy(true);
    setSubmitError(null);
    try {
      if (memberMode === "position" && payload.position) {
        await setUserPosition(memberTarget.id, { position: payload.position });
        setToast({ message: "Position updated.", type: "success" });
      } else if (memberMode === "move" && payload.departmentId) {
        await assignUserDepartment(memberTarget.id, { departmentId: payload.departmentId });
        setToast({ message: "Member moved to another department.", type: "success" });
      }
      setMemberTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not update member.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageTitle title="Department" subtitle="Loadingâ€¦" />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (loadError || !dept) {
    return (
      <div>
        <PageTitle title="Department" />
        <ErrorState message={loadError ?? "Department not found."} onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/org/departments"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to departments
      </Link>

      <PageTitle
        title={dept.name}
        subtitle={`${dept.code} Â· ${dept.staff.length} member${dept.staff.length === 1 ? "" : "s"}`}
        action={
          canManage ? (
            <button
              type="button"
              onClick={openSetHead}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Crown className="h-3.5 w-3.5" /> Set head
            </button>
          ) : undefined
        }
      />

      {/* Head card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 shrink-0">
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Head of Department (HOD)</p>
          {dept.head ? (
            <>
              <p className="text-base font-black text-slate-900">{dept.head.name}</p>
              <p className="text-xs text-slate-500">{dept.staff.find((s) => s.id === dept.head!.id)?.email ?? "Department head"}</p>
            </>
          ) : (
            <p className="text-base font-semibold text-slate-400">No head assigned</p>
          )}
        </div>
      </div>

      {/* Staff table */}
      <h2 className="text-sm font-black text-slate-900 mb-3">Staff</h2>
      {dept.staff.length === 0 ? (
        <EmptyState title="No staff in this department" description="Members assigned here will appear in this list." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</th>
                  {canAssign && <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dept.staff.map((m) => (
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
                    <td className="px-4 py-3 text-sm text-slate-600">{m.departmentName ?? "â€”"}</td>
                    {canAssign && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMemberAction(m, "position")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Position
                          </button>
                          <button
                            type="button"
                            onClick={() => openMemberAction(m, "move")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Move
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Want to add more members? Assign staff from the directory to this department.
          </p>
          <Link
            href="/org/staff"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Staff directory
          </Link>
        </div>
      )}

      <SetHeadModal
        open={headOpen}
        busy={busy}
        error={submitError}
        candidates={headCandidates}
        currentHeadId={dept.head?.id ?? null}
        onClose={() => setHeadOpen(false)}
        onSubmit={handleSetHead}
      />

      <MemberActionModal
        open={!!memberTarget}
        busy={busy}
        error={submitError}
        mode={memberMode}
        member={memberTarget}
        departments={departments}
        currentPosition={memberTarget?.position ?? null}
        onClose={() => setMemberTarget(null)}
        onSubmit={handleMemberAction}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
