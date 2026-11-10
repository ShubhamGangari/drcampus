import { withClient } from '@/lib/prisma';
import { withAuth, successResponse, ApiError } from '@/lib/api';
import { loadProgramTenant, computePOAttainment } from '@/lib/obe-core';
import { guardRole } from '@/lib/perms';

export const dynamic = 'force-dynamic';

// PO attainment report: DEAN / REGISTRAR_ADMIN only (faculty cannot view program
// level attainment per spec).

// ---------------------------------------------------------------------------
// GET /api/obe/reports/po-attainment?programId=&academicYear= — program PO
// attainment report. 200 { programId, academicYear, pos: [{ poId, poCode,
// attainment, contributingCourses: [{ courseId, courseCode, courseTitle,
// attainment }] }] } — only POs with at least one contributing course for the
// requested year are included (spec §6.4).
// ---------------------------------------------------------------------------
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const programId = url.searchParams.get('programId');
  const academicYear = url.searchParams.get('academicYear');

  if (!guardRole(user.role, 'DEAN', 'REGISTRAR_ADMIN')) {
    throw new ApiError(403, 'FORBIDDEN', 'Dean or registrar access required');
  }

  return withClient(user, async (db) => {
    if (!programId) {
      return successResponse({ programId: null, academicYear, pos: [] });
    }

    const { tenant } = await loadProgramTenant(db, user, programId);

    const posList = await db.programOutcome.findMany({
      where: { schoolId: tenant, programId },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    });

    const courses = await db.course.findMany({
      where: { schoolId: tenant, programId },
      select: { id: true, code: true, title: true },
    });

    if (posList.length === 0 || courses.length === 0) {
      // Spec §6.4: empty results are empty arrays — POs without any contributing
      // course for the requested year are omitted (no `attainment: 0`).
      return successResponse({ programId, academicYear, pos: [] });
    }

    const courseIds = courses.map((c) => c.id);
    const courseInfo = new Map<string, { id: string; code: string; title: string }>();
    for (const c of courses) courseInfo.set(c.id, c);

    const [mappings, attainments] = await Promise.all([
      db.cOPOMapping.findMany({
        where: { schoolId: tenant, courseId: { in: courseIds } },
        select: { courseId: true, coId: true, poId: true, weight: true },
      }),
      db.cOAttainment.findMany({
        where: { schoolId: tenant, courseId: { in: courseIds }, academicYear: academicYear ?? undefined },
        select: { courseId: true, coId: true, attainment: true },
      }),
    ]);

    const attainmentValues = attainments.map((a) => ({
      coId: a.coId,
      attainment: a.attainment,
    }));
    const attainmentCourse = new Map<string, string>();
    for (const a of attainments) attainmentCourse.set(a.coId, a.courseId);

    const mappingsByPo = new Map<string, { courseId: string; coId: string; poId: string; weight: number }[]>();
    for (const m of mappings) {
      const list = mappingsByPo.get(m.poId) ?? [];
      list.push(m);
      mappingsByPo.set(m.poId, list);
    }

    const pos = posList.map((p) => {
      const poMappings = mappingsByPo.get(p.id) ?? [];
      const weights = poMappings.map((m) => ({ coId: m.coId, weight: m.weight }));
      const attainment = computePOAttainment(weights, attainmentValues);

      const contributing = new Map<string, { courseId: string; courseCode: string | null; courseTitle: string | null; attainment: number }>();
      for (const m of poMappings) {
        const cId = attainmentCourse.get(m.coId);
        if (cId && !contributing.has(cId)) {
          const c = courseInfo.get(cId);
          // Per-course contributing attainment for this PO in the requested year:
          // aggregate over this course's COs that map to this PO (same weighted
          // average logic used for the PO attainment, restricted to this course).
          const courseWeights = poMappings
            .filter((cm) => cm.courseId === cId)
            .map((cm) => ({ coId: cm.coId, weight: cm.weight }));
          contributing.set(cId, {
            courseId: cId,
            courseCode: c?.code ?? null,
            courseTitle: c?.title ?? null,
            attainment: computePOAttainment(courseWeights, attainmentValues),
          });
        }
      }

      // Spec §6.4: omit POs with no contributing course for the requested year
      // (do not emit `attainment: 0`).
      if (contributing.size === 0) return null;

      return {
        poId: p.id,
        poCode: p.code,
        attainment,
        contributingCourses: Array.from(contributing.values()),
      };
    }).filter((result) => result !== null);

    return successResponse({ programId, academicYear, pos });
  });
});
