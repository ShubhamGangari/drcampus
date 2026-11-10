"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Pencil, Briefcase, Mail, Phone, CalendarDays, Hash } from "lucide-react";
import { PageTitle } from "@/components/alumni/AlumniShell";
import { EditProfileModal } from "@/components/alumni/EditProfileModal";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admissions/States";
import { SchoolSelect } from "@/components/fees/SchoolSelect";
import { useUniversity } from "@/context/UniversityContext";
import {
  Alumni,
  AlumniApiError,
  canManageAlumni,
  canViewAlumni,
  fetchAlumni,
  fetchMyAlumni,
  formatDate,
  isAlumniStudent,
  updateAlumni,
  UpdateAlumniInput,
} from "@/lib/alumni";

export default function AlumniProfilePage() {
  const { currentUser } = useUniversity();
  const isCentral = currentUser?.schoolId === "ALL";
  const isStudent = isAlumniStudent(currentUser?.role);
  const canEditAny = canManageAlumni(currentUser?.role);
  const canView = canViewAlumni(currentUser?.role) || isStudent;

  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<Alumni[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isStudent) {
        const mine = await fetchMyAlumni();
        setRows([mine]);
        setSelectedId(mine.id);
        return;
      }
      const list = await fetchAlumni({
        schoolId: isCentral && schoolId ? schoolId : undefined,
      });
      setRows(list);
      setSelectedId((prev) =>
        prev && list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? null)
      );
    } catch (e) {
      setLoadError(e instanceof AlumniApiError ? e.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, [isCentral, schoolId, isStudent]);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [load, canView]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const canEdit = selected ? canEditAny || (isStudent && selected.studentId === currentUser?.id) : false;

  const handleSave = async (input: UpdateAlumniInput) => {
    if (!selected) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await updateAlumni(selected.id, input);
      setEditOpen(false);
      setToast({ message: "Profile updated successfully.", type: "success" });
      await load();
    } catch (e) {
      setSubmitError(e instanceof AlumniApiError ? e.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title={isStudent ? "My Alumni Profile" : "Alumni Profile"}
        subtitle={
          isStudent
            ? "Keep your contact and employment details up to date"
            : "View and edit alumni records"
        }
        action={
          canEdit ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </button>
          ) : undefined
        }
      />

      {!isStudent && isCentral && (
        <div className="sm:max-w-xs mb-5">
          <SchoolSelect value={schoolId} onChange={setSchoolId} />
        </div>
      )}

      {!isStudent && (
        <div className="sm:max-w-md mb-5">
          <label htmlFor="alumni-record-select" className="block text-xs font-bold text-slate-700 mb-1.5">
            Alumni record
          </label>
          <select
            id="alumni-record-select"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select alumni…</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.studentName}
                {r.batch ? ` · ${r.batch}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={3} />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : !selected ? (
          <EmptyState
            title={isStudent ? "You are not yet an alumnus" : "No alumni records found"}
            description={
              isStudent
                ? "Your alumni profile is not available yet. Contact the registrar to create your record."
                : "There are no alumni records in this school yet."
            }
          />
        ) : (
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {selected.studentName}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Student ID: {selected.studentId}
                </p>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              <InfoItem icon={Hash} label="Batch" value={selected.batch ?? "—"} />
              <InfoItem icon={Briefcase} label="Current company" value={selected.currentCompany ?? "—"} />
              <InfoItem icon={Mail} label="Email" value={selected.email} />
              <InfoItem icon={Phone} label="Phone" value={selected.phone ?? "—"} />
              <InfoItem icon={CalendarDays} label="Record created" value={formatDate(selected.createdAt)} />
            </dl>
          </div>
        )}
      </div>

      {canEdit && selected && (
        <EditProfileModal
          open={editOpen}
          busy={busy}
          error={submitError}
          initial={{
            email: selected.email,
            phone: selected.phone,
            currentCompany: selected.currentCompany,
            batch: selected.batch,
          }}
          onClose={() => setEditOpen(false)}
          onSubmit={handleSave}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
        <dd className="text-sm font-semibold text-slate-800 mt-0.5">{value}</dd>
      </div>
    </div>
  );
}
