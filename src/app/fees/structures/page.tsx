"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Copy } from "lucide-react";
import { PageTitle } from "@/components/fees/FeesShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { CreateStructureModal } from "@/components/fees/CreateStructureModal";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS, programCode } from "@/lib/students";
import {
  academicYearChoices,
  createStructure,
  CreateStructureInput,
  FeesApiError,
  FeeStructure,
  fetchStructures,
  formatAmount,
  updateStructure,
} from "@/lib/fees";

interface ModalState {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  record: FeeStructure | null;
}

export default function FeesStructuresPage() {
  const { currentUser } = useUniversity();
  const isFinance = currentUser?.role === "FINANCE_OFFICER";
  const isCentral = currentUser?.schoolId === "ALL";

  const [rows, setRows] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const [modal, setModal] = useState<ModalState>({ open: false, mode: "create", record: null });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchStructures({
        programId: programFilter || undefined,
        academicYear: yearFilter || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof FeesApiError ? e.message : "Unable to load fee structures.");
    } finally {
      setLoading(false);
    }
  }, [programFilter, yearFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (input: CreateStructureInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      if (modal.mode === "edit" && modal.record) {
        const updated = await updateStructure(modal.record.id, input);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setToast({ message: "Fee structure updated.", type: "success" });
      } else {
        await createStructure(input);
        setToast({
          message: modal.mode === "duplicate" ? "Fee structure duplicated." : "Fee structure created.",
          type: "success",
        });
        load();
      }
      setModal({ open: false, mode: "create", record: null });
    } catch (e) {
      setSubmitError(e instanceof FeesApiError ? e.message : "Unable to save fee structure.");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => setModal({ open: true, mode: "create", record: null });
  const openEdit = (r: FeeStructure) => setModal({ open: true, mode: "edit", record: r });
  const openDuplicate = (r: FeeStructure) => setModal({ open: true, mode: "duplicate", record: r });

  return (
    <div>
      <PageTitle
        title="Fee Structures"
        subtitle="Tuition and fee component templates per program, year and semester."
        action={
          isFinance ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New structure
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          aria-label="Filter by program"
        >
          <option value="">All programs</option>
          {PROGRAM_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full sm:w-48 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
          aria-label="Filter by academic year"
        >
          <option value="">All years</option>
          {academicYearChoices().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No fee structures"
            description="Fee structures created for programs will appear here. Create one to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Program</th>
                  <th className="px-5 py-3.5">Academic year</th>
                  <th className="px-5 py-3.5">Semester</th>
                  <th className="px-5 py-3.5">Components</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  {isFinance && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900">{programCode(row.programId)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{row.academicYear}</td>
                    <td className="px-5 py-3.5 text-slate-600">Semester {row.semester}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.components.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          >
                            {c.name}
                            <span className="text-slate-400 tabular-nums">{formatAmount(c.amount)}</span>
                          </span>
                        ))}
                        {row.components.length > 3 && (
                          <span className="text-[11px] font-bold text-slate-400">
                            +{row.components.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 tabular-nums">
                      {formatAmount(row.totalAmount)}
                    </td>
                    {isFinance && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            aria-label={`Edit structure for ${programCode(row.programId)}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicate(row)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            aria-label={`Duplicate structure for ${programCode(row.programId)}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateStructureModal
        open={modal.open}
        mode={modal.mode}
        initial={modal.record}
        busy={busy}
        error={submitError}
        schoolRequired={isCentral}
        onClose={() => setModal({ open: false, mode: "create", record: null })}
        onSubmit={submit}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
