"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { PageTitle } from "@/components/org/OrgShell";
import { ClassCreateModal } from "@/components/org/ClassCreateModal";
import { SetCoordinatorModal } from "@/components/org/SetCoordinatorModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { useUniversity } from "@/context/UniversityContext";
import {
  canManageClasses,
  ClassGroup,
  CreateClassInput,
  createClass,
  fetchClasses,
  fetchStaff,
  OrgApiError,
  setClassCoordinator,
  StaffMember,
} from "@/lib/org-client";
import { PROGRAM_OPTIONS } from "@/lib/students";

export default function OrgClassesPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canManage = canManageClasses(currentUser);

  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [rows, setRows] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [coordTarget, setCoordTarget] = useState<ClassGroup | null>(null);
  const [coordCandidates, setCoordCandidates] = useState<StaffMember[]>([]);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const programName = (pid: string) => PROGRAM_OPTIONS.find((p) => p.id === pid)?.name ?? pid;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchClasses({
        schoolId: isCentral && schoolId ? schoolId : undefined,
        programId: programId || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof OrgApiError ? e.message : "Unable to load class groups.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, programId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCoordCandidates = async () => {
    try {
      const staff = await fetchStaff({});
      const eligible = staff.filter((s) => s.role === "FACULTY" || s.position === "CLASS_COORDINATOR");
      setCoordCandidates(eligible);
    } catch {
      setCoordCandidates([]);
    }
  };

  const openSetCoordinator = (cls: ClassGroup) => {
    setSubmitError(null);
    setCoordTarget(cls);
    void loadCoordCandidates();
  };

  const handleCreate = async (input: CreateClassInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createClass(input);
      setCreateOpen(false);
      setToast({ message: "Class group created.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not create class group.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCoordinator = async (coordinatorUserId: string) => {
    if (!coordTarget) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await setClassCoordinator(coordTarget.id, coordinatorUserId);
      setCoordTarget(null);
      setToast({ message: "Class coordinator set.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof OrgApiError ? e.message : "Could not set class coordinator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Class groups"
        subtitle="Program batches split into sections, each with an optional class coordinator."
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
              <Plus className="h-3.5 w-3.5" /> Create section
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-lg">
        {isCentral && <SchoolSelect value={schoolId} onChange={setSchoolId} />}
        <Field label="Program" htmlFor="class-filter-program">
          <SelectInput id="class-filter-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">All programs</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No class groups yet"
          description="Create a section under a program batch to get started."
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
                <Plus className="h-3.5 w-3.5" /> Create section
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
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Program</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Batch</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Section</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Coordinator</th>
                  {canManage && <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{c.programName ?? programName(c.programId)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.batchName ?? c.batchId}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                        Section {c.section}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {c.coordinatorName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="h-3.5 w-3.5 text-slate-400" /> {c.coordinatorName}
                        </span>
                      ) : (
                        <span className="text-slate-400">No coordinator</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => openSetCoordinator(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <UserRound className="h-3.5 w-3.5" /> Set coordinator
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

      <ClassCreateModal
        open={createOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <SetCoordinatorModal
        open={!!coordTarget}
        busy={busy}
        error={submitError}
        title="Set class coordinator"
        description={coordTarget ? `Assign a coordinator to Section ${coordTarget.section}.` : undefined}
        candidates={coordCandidates}
        currentCoordinatorId={coordTarget?.coordinatorUserId ?? null}
        onClose={() => setCoordTarget(null)}
        onSubmit={handleSetCoordinator}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
