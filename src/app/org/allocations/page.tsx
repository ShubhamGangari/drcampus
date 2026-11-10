"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/org/OrgShell";
import { AllocationCreateModal } from "@/components/org/AllocationCreateModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { useUniversity } from "@/context/UniversityContext";
import { fetchCourses } from "@/lib/obe";
import { PROGRAM_OPTIONS } from "@/lib/students";
import {
  Allocation,
  canAllocateCourses,
  createAllocation,
  CreateAllocationInput,
  deleteAllocation,
  DepartmentListItem,
  fetchAllocations,
  fetchClasses,
  fetchDepartments,
  fetchStaff,
  OrgApiError,
  StaffMember,
} from "@/lib/org-client";

interface CourseOption {
  id: string;
  label: string;
}

export default function OrgAllocationsPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canAllocate = canAllocateCourses(currentUser);

  const [schoolId, setSchoolId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [facultyUserId, setFacultyUserId] = useState("");

  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; label: string }[]>([]);
  const [faculty, setFaculty] = useState<StaffMember[]>([]);

  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Allocation | null>(null);

  const programName = (pid: string) => PROGRAM_OPTIONS.find((p) => p.id === pid)?.name ?? pid;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchAllocations({
        schoolId: isCentral && schoolId ? schoolId : undefined,
        departmentId: departmentId || undefined,
        classGroupId: classGroupId || undefined,
        facultyUserId: facultyUserId || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof OrgApiError ? e.message : "Unable to load allocations.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, departmentId, classGroupId, facultyUserId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load filter dropdown data once.
  useEffect(() => {
    fetchDepartments({})
      .then((d) => setDepartments(d.items ?? []))
      .catch(() => setDepartments([]));
    fetchClasses({})
      .then((list) =>
        setClasses(
          list.map((c) => ({
            id: c.id,
            label: `${c.programName ?? programName(c.programId)} Â· ${c.batchName ?? c.batchId} Â· Section ${c.section}`,
          }))
        )
      )
      .catch(() => setClasses([]));
    fetchStaff({})
      .then(setFaculty)
      .catch(() => setFaculty([]));
  }, []);

  const openCreate = () => {
    setSubmitError(null);
    setCreateOpen(true);
    fetchCourses()
      .then((cs) =>
        setCourses(
          cs.map((c) => ({ id: c.id, label: `${c.courseCode} Â· ${c.courseTitle}` }))
        )
      )
      .catch(() => setCourses([]));
  };

  const handleCreate = async (input: CreateAllocationInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createAllocation(input);
      setCreateOpen(false);
      setToast({ message: "Course allocated to faculty.", type: "success" });
      await load();
    } catch (e) {
      if (e instanceof OrgApiError && e.status === 409) {
        setSubmitError(
          "This course is already allocated to the same class, semester and academic year. Choose a different combination."
        );
      } else {
        setSubmitError(e instanceof OrgApiError ? e.message : "Could not create allocation.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await deleteAllocation(confirmDelete.id);
      setToast({ message: "Allocation removed.", type: "success" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setToast({ message: e instanceof OrgApiError ? e.message : "Could not delete allocation.", type: "error" });
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const classLabel = (id: string) => classes.find((c) => c.id === id)?.label ?? id;
  const facultyName = (id: string) => faculty.find((f) => f.id === id)?.name ?? id;

  return (
    <div>
      <PageTitle
        title="Courseâ€“faculty allocations"
        subtitle="Assign faculty to teach courses for a class group in a semester."
        action={
          canAllocate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Allocate course
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isCentral && <SchoolSelect value={schoolId} onChange={setSchoolId} />}
        <Field label="Department" htmlFor="alloc-filter-dept">
          <SelectInput id="alloc-filter-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Class" htmlFor="alloc-filter-class">
          <SelectInput id="alloc-filter-class" value={classGroupId} onChange={(e) => setClassGroupId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Faculty" htmlFor="alloc-filter-faculty">
          <SelectInput id="alloc-filter-faculty" value={facultyUserId} onChange={(e) => setFacultyUserId(e.target.value)}>
            <option value="">All faculty</option>
            {faculty.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No allocations yet"
          description="Allocate a course to faculty so departments know who teaches what."
          action={
            canAllocate ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Allocate course
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
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Course</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Faculty</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Semester</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Academic Year</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</th>
                  {canAllocate && <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{a.courseTitle ?? a.courseId}</p>
                        {a.courseCode && <p className="text-[11px] text-slate-400 font-medium">{a.courseCode}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.classLabel ?? classLabel(a.classGroupId)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{a.facultyName ?? facultyName(a.facultyUserId)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                        Sem {a.semester}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.academicYear}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.departmentName ?? departments.find((d) => d.id === a.departmentId)?.name ?? "â€”"}</td>
                    {canAllocate && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitError(null);
                              setConfirmDelete(a);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
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

      <AllocationCreateModal
        open={createOpen}
        busy={busy}
        error={submitError}
        courses={courses}
        classes={classes}
        faculty={faculty}
        departments={departments}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => !busy && setConfirmDelete(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Delete allocation" className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900">Delete allocation</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Remove this courseâ€“faculty allocation? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-5">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60">
                {busy ? "Deletingâ€¦" : "Delete allocation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
