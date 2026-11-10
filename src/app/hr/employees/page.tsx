"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { PageTitle } from "@/components/hr/HrShell";
import { AddEmployeeModal } from "@/components/hr/AddEmployeeModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  canManageEmployees,
  createEmployee,
  CreateEmployeeInput,
  Employee,
  fetchEmployees,
  fetchMyEmployee,
  HrApiError,
  isFaculty,
} from "@/lib/hr";

export default function HrEmployeesPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canAdd = canManageEmployees(currentUser?.role);
  const facultyScoped = isFaculty(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (facultyScoped) {
        // Faculty sees only their own record via /me.
        try {
          const mine = await fetchMyEmployee();
          setRows([mine]);
        } catch (e) {
          if (e instanceof HrApiError && e.status === 404) {
            setRows([]);
          } else {
            throw e;
          }
        }
      } else {
        const list = await fetchEmployees({ schoolId: isCentral && schoolId ? schoolId : undefined });
        setRows(list);
      }
    } catch (e) {
      setLoadError(e instanceof HrApiError ? e.message : "Unable to load employees.");
    } finally {
      setLoading(false);
    }
  }, [facultyScoped, isCentral, schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (input: CreateEmployeeInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createEmployee(input);
      setModalOpen(false);
      setToast({ message: "Employee added successfully.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof HrApiError ? e.message : "Could not add employee.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Employees"
        subtitle={facultyScoped ? "Your employee record" : "Staff directory across departments"}
        action={
          canAdd ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Employee
            </button>
          ) : undefined
        }
      />

      {isCentral && !facultyScoped && (
        <div className="max-w-xs mb-6">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={facultyScoped ? "No employee record" : "No employees yet"}
          description={
            facultyScoped
              ? "Your faculty profile is not linked to an employee record yet. Contact the registrar."
              : "Add your first employee to start managing payroll and leave."
          }
          action={
            canAdd ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Employee
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold">Employee ID</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Designation</th>
                  <th className="px-4 py-3 font-bold">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.employeeId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{emp.designation}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddEmployeeModal
        open={modalOpen}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral && canAdd}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
