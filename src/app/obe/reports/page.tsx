"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageTitle } from "@/components/obe/ObEShell";
import { Toast } from "@/components/admissions/Toast";
import { EmptyState, ErrorState } from "@/components/admissions/States";
import { Field, SelectInput } from "@/components/admissions/FormControls";
import { useUniversity } from "@/context/UniversityContext";
import { PROGRAM_OPTIONS } from "@/lib/students";
import { academicYearChoices } from "@/lib/fees";
import {
  canEditObe,
  canViewPoReports,
  CourseAttainmentReport,
  CourseOutcomeSet,
  downloadCsv,
  fetchCourseAttainmentReport,
  fetchCourses,
  fetchPoAttainmentReport,
  ObeApiError,
  PoAttainmentReport,
  toCsv,
} from "@/lib/obe";

const AY = academicYearChoices(4);

export default function ObeReportsPage() {
  const { currentUser } = useUniversity();
  const isFaculty = canEditObe(currentUser?.role);
  const showPoReport = canViewPoReports(currentUser?.role);
  const isCentral = currentUser?.isCentral || currentUser?.schoolId === "ALL";

  const [courses, setCourses] = useState<CourseOutcomeSet[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // Course attainment report
  const [courseProgramId, setCourseProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseYear, setCourseYear] = useState(AY[0]);
  const [courseReport, setCourseReport] = useState<CourseAttainmentReport | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Program PO attainment report
  const [programId, setProgramId] = useState("");
  const [poYear, setPoYear] = useState(AY[0]);
  const [poReport, setPoReport] = useState<PoAttainmentReport | null>(null);
  const [poLoading, setPoLoading] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    (async () => {
      setCoursesLoading(true);
      setCoursesError(null);
      try {
        if (isCentral && !courseProgramId) {
          setCourses([]);
          setCourseId("");
          return;
        }
        const list = await fetchCourses(isCentral ? courseProgramId : undefined);
        setCourses(list);
        setCourseId((prev) => (list.some((c) => c.courseId === prev) ? prev : ""));
      } catch (e) {
        setCoursesError(e instanceof ObeApiError ? e.message : "Unable to load courses.");
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, [isCentral, courseProgramId]);

  const loadCourseReport = useCallback(async () => {
    if (!courseId) return;
    setCourseLoading(true);
    setCourseError(null);
    try {
      setCourseReport(await fetchCourseAttainmentReport({ courseId, academicYear: courseYear }));
    } catch (e) {
      setCourseError(e instanceof ObeApiError ? e.message : "Unable to load course attainment report.");
    } finally {
      setCourseLoading(false);
    }
  }, [courseId, courseYear]);

  const loadPoReport = useCallback(async () => {
    if (!programId) return;
    setPoLoading(true);
    setPoError(null);
    try {
      setPoReport(await fetchPoAttainmentReport({ programId, academicYear: poYear }));
    } catch (e) {
      setPoError(e instanceof ObeApiError ? e.message : "Unable to load PO attainment report.");
    } finally {
      setPoLoading(false);
    }
  }, [programId, poYear]);

  const exportCourseCsv = () => {
    if (!courseReport) return;
    const rows: (string | number)[][] = [
      ["Course Code", "Academic Year", "CO Code", "Attainment"],
    ];
    for (const co of courseReport.cos) {
      rows.push([courseReport.courseCode, courseReport.academicYear, co.coCode, co.attainment]);
    }
    downloadCsv(`obe-course-attainment-${courseReport.courseCode}-${courseReport.academicYear}.csv`, toCsv(rows));
    setToast({ message: "Course attainment CSV downloaded.", type: "success" });
  };

  const exportPoCsv = () => {
    if (!poReport) return;
    const rows: (string | number)[][] = [
      ["Program ID", "Academic Year", "PO Code", "Attainment", "Contributing Courses"],
    ];
    for (const po of poReport.pos) {
      const contributing = po.contributingCourses.map((c) => `${c.courseCode}: ${c.attainment}%`).join(" | ");
      rows.push([poReport.programId, poReport.academicYear, po.poCode, po.attainment, contributing]);
    }
    downloadCsv(`obe-po-attainment-${poReport.programId}-${poReport.academicYear}.csv`, toCsv(rows));
    setToast({ message: "PO attainment CSV downloaded.", type: "success" });
  };

  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Course and program attainment reports for accreditation (NAAC/NBA/NIRF)."
      />

      {/* Course attainment report */}
      <section className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">Course CO Attainment</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Per-course outcome attainment (0–100).</p>
          </div>
          {courseReport && (
            <button
              type="button"
              onClick={exportCourseCsv}
              className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {isCentral && (
            <Field label="Course program" htmlFor="obe-rep-course-program">
              <SelectInput
                id="obe-rep-course-program"
                value={courseProgramId}
                onChange={(e) => setCourseProgramId(e.target.value)}
              >
                <option value="">Select program</option>
                {PROGRAM_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}
          <Field label="Course" htmlFor="obe-rep-course">
            <SelectInput
              id="obe-rep-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={coursesLoading || (isCentral && !courseProgramId)}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseCode} — {c.courseTitle}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Academic year" htmlFor="obe-rep-course-year">
            <SelectInput id="obe-rep-course-year" value={courseYear} onChange={(e) => setCourseYear(e.target.value)}>
              {AY.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {coursesError ? (
          <ErrorState message={coursesError} onRetry={() => window.location.reload()} />
        ) : courseLoading ? (
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />
        ) : courseError ? (
          <ErrorState message={courseError} onRetry={loadCourseReport} />
        ) : !courseId ? (
          <EmptyState
            title={isCentral && !courseProgramId ? "Select a program" : "Select a course"}
            description={
              isCentral && !courseProgramId
                ? "Choose a program first to load its available courses."
                : "Choose a course and academic year to view its CO attainment."
            }
          />
        ) : !courseReport ? (
          <EmptyState title="No report" description="No course attainment report is available for this selection." />
        ) : courseReport.cos.length === 0 ? (
          <EmptyState title="No CO attainment" description="No attainment data recorded for this course. Enter values on the Attainment screen." />
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">CO</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Attainment</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">%</th>
                </tr>
              </thead>
              <tbody>
                {courseReport.cos.map((co) => (
                  <tr key={co.coId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 text-xs font-black text-slate-800">{co.coCode}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{co.attainment}</td>
                    <td className="px-4 py-3 text-xs font-bold text-indigo-700">{co.attainment}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Program PO attainment report (Dean / Registrar only) */}
      {showPoReport && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Program PO Attainment</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Program-level PO attainment across contributing courses.</p>
            </div>
            {poReport && (
              <button
                type="button"
                onClick={exportPoCsv}
                className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Field label="Program" htmlFor="obe-rep-program">
              <SelectInput id="obe-rep-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">Select program</option>
                {PROGRAM_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Academic year" htmlFor="obe-rep-po-year">
              <SelectInput id="obe-rep-po-year" value={poYear} onChange={(e) => setPoYear(e.target.value)}>
                {AY.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          {poLoading ? (
            <div className="h-24 rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />
          ) : poError ? (
            <ErrorState message={poError} onRetry={loadPoReport} />
          ) : !programId ? (
            <EmptyState title="Select a program" description="Choose a program and academic year to view its PO attainment." />
          ) : !poReport ? (
            <EmptyState title="No report" description="No PO attainment report is available for this selection." />
          ) : poReport.pos.length === 0 ? (
            <EmptyState title="No PO attainment" description="No program outcomes are defined or mapped for this program." />
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">PO</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Attainment</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Contributing Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {poReport.pos.map((po) => (
                    <tr key={po.poId} className="border-b border-slate-100 last:border-b-0 align-top">
                      <td className="px-4 py-3 text-xs font-black text-slate-800">{po.poCode}</td>
                      <td className="px-4 py-3 text-xs font-bold text-indigo-700">{po.attainment}%</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {po.contributingCourses.map((c) => (
                            <span key={c.courseId} className="text-[10px] font-bold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                              {c.courseCode}: {c.attainment}%
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {isFaculty && !showPoReport && (
        <p className="text-xs text-slate-400 mt-6">
          Program-level PO reports are available to Deans and Registrars.
        </p>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
