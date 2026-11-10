"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Pencil, Crown, Users } from "lucide-react";
import { PageTitle } from "@/components/org/OrgShell";
import { DepartmentModal } from "@/components/org/DepartmentModal";
import { SetHeadModal } from "@/components/org/SetHeadModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import { fetchSchools, SchoolOption } from "@/lib/fees";
import {
  canManageDepartments,
  createDepartment,
  CreateDepartmentInput,
  DepartmentListItem,
  deleteDepartment,
  fetchDepartments,
  fetchStaff,
  OrgApiError,
  setDepartmentHead,
  StaffMember,
  updateDepartment,
  UpdateDepartmentInput,
} from "@/lib/org-client";

export default function OrgDepartmentsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canManage = canManageDepartments(currentUser);

  const [schoolId, setSchoolId] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [rows, setRows] = useState<DepartmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentListItem | null>(null);
  const [headTarget, setHeadTarget] = useState<DepartmentListItem | null>(null);
  const [headCandidates, setHeadCandidates] = useState<StaffMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DepartmentListItem | null>(null);

  const schoolName = useCallback(
    (id: string) => schoolOptions.find((s) => s.id === id)?.name ?? id,
    [schoolOptions]
  );

  useEffect(() => {
    fetchSchools()
      .then(setSchoolOptions)
      .catch(() => setSchoolOptions([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDepartments({ schoolId: isCentral && schoolId ? schoolId : undefined });
      setRows(data.items ?? []);
    } catch (e) {
      setLoadError(e instanceof OrgApiError ? e.message : "Unable to load departments.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadHeadCandidates = async () => {
    try {
      const staff = await fetchStaff({});
      const eligible = staff.filter((s) => s.role === "DEAN" || s.position === "HOD");
      setHeadCandidates(eligible);
    } catch {
      setHeadCandidates([]);
    }
  };

  const openSetHead = (dept: DepartmentListItem) => {
    setSubmitError(null);
    setHeadTarget(dept);
    void loadHeadCandidates();
  };

  const handleCreate = async (input: CreateDepartmentInput | UpdateDepartmentInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createDepartment(input as CreateDepartmentInput);
      setCreateOpen(false);
      setToast({ message: "Department created.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not create department.");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (input: CreateDepartmentInput | UpdateDepartmentInput) => {
    if (!editTarget) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await updateDepartment(editTarget.id, input as UpdateDepartmentInput);
      setEditTarget(null);
      setToast({ message: "Department updated.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not update department.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetHead = async (headUserId: string | null) => {
    if (!headTarget) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await setDepartmentHead(headTarget.id, { headUserId });
      setHeadTarget(null);
      setToast({ message: "Department head updated.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not set department head.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await deleteDepartment(confirmDelete.id);
      setToast({ message: "Department deleted.", type: "success" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setToast({ message: e instanceof OrgApiError ? e.message : "Could not delete department.", type: "error" });
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Departments"
        subtitle="Schools â†’ departments. Organize staff, classes and allocations by department."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Create department
            </button>
          ) : undefined
        }
      />

      {isCentral && (
        <div className="max-w-xs mb-5">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Create a department to start organizing staff, classes and course allocations."
          action={
            canManage ? (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Create department
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">School</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Head (HOD)</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Members</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                        {d.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/org/departments/${d.id}`} className="group inline-flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-indigo-700 transition-colors">
                        {d.name}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{schoolName(d.schoolId)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {d.head ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                          {d.head.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">No head</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{d.memberCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/org/departments/${d.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Users className="h-3.5 w-3.5" /> View
                        </Link>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSubmitError(null);
                                setEditTarget(d);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openSetHead(d)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                              <Crown className="h-3.5 w-3.5" /> Set head
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSubmitError(null);
                                setConfirmDelete(d);
                              }}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DepartmentModal
        open={createOpen}
        busy={busy}
        error={submitError}
        mode="create"
        schoolRequired={isCentral}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DepartmentModal
        open={!!editTarget}
        busy={busy}
        error={submitError}
        mode="edit"
        initial={editTarget ? { name: editTarget.name, code: editTarget.code } : undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />

      <SetHeadModal
        open={!!headTarget}
        busy={busy}
        error={submitError}
        candidates={headCandidates}
        currentHeadId={headTarget?.head?.id ?? null}
        onClose={() => setHeadTarget(null)}
        onSubmit={handleSetHead}
      />

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => !busy && setConfirmDelete(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Delete department" className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900">Delete department</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Delete <span className="font-semibold text-slate-700">{confirmDelete.name}</span>? This cannot be undone.
            </p>
            {submitError && <p className="text-xs font-medium text-rose-600 mt-3" role="alert">{submitError}</p>}
            <div className="flex items-center justify-end gap-2 pt-5">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60">
                {busy ? "Deletingâ€¦" : "Delete department"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
