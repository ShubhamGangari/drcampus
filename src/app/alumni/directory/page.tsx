"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, GraduationCap, Search, Building2, Mail, Phone } from "lucide-react";
import { PageTitle } from "@/components/alumni/AlumniShell";
import { AddAlumniModal } from "@/components/alumni/AddAlumniModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  Alumni,
  AlumniApiError,
  canManageAlumni,
  canViewAlumni,
  createAlumni,
  CreateAlumniInput,
  fetchAlumni,
} from "@/lib/alumni";

export default function AlumniDirectoryPage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const canAdd = canManageAlumni(currentUser?.role);
  const canView = canViewAlumni(currentUser?.role);

  const [schoolId, setSchoolId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Alumni[]>([]);
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
      const list = await fetchAlumni({
        schoolId: isCentral && schoolId ? schoolId : undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof AlumniApiError ? e.message : "Unable to load alumni directory.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId]);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [load, canView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        (r.currentCompany ?? "").toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleCreate = async (input: CreateAlumniInput) => {
    setBusy(true);
    setSubmitError(null);
    try {
      await createAlumni(input);
      setModalOpen(false);
      setToast({ message: "Alumni record created successfully.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof AlumniApiError ? e.message : "Could not create alumni record.");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return (
      <div>
        <PageTitle title="Directory" subtitle="Alumni directory" />
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <EmptyState
            title="No access to the directory"
            description="The alumni directory is available to registrar administrators and deans. As an alumni student you can manage your profile, events and donations."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Alumni Directory"
        subtitle="Graduated students across the school"
        action={
          canAdd ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Alumni
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {isCentral && (
          <div className="sm:max-w-xs">
            <SchoolSelect value={schoolId} onChange={setSchoolId} />
          </div>
        )}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company or email…"
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
            aria-label="Search alumni"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={4} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No matching alumni" : "No alumni records yet"}
            description={
              search
                ? "Try a different name, company or email."
                : "Add your first alumni record to populate the directory."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Alumni
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Batch
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Current company
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-900">{row.studentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{row.batch ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {row.currentCompany ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {row.email}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {row.phone ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canAdd && (
        <AddAlumniModal
          open={modalOpen}
          busy={busy}
          error={submitError}
          schoolRequired={isCentral}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
        />
      )}

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
