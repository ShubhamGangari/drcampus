import { withClient } from '@/lib/prisma';
import { withAuth, errorResponse, ApiError } from '@/lib/api';
import { findSelfStudent, userHasPermission } from '@/lib/certificates-core';

export const dynamic = 'force-dynamic';

/**
 * Renders a printable, self-contained HTML certificate. This is intentionally
 * standalone (no external assets) so the browser can print/export it directly.
 */
function renderCertificateHtml(cert: {
    type: string;
    requestNo: string;
    referenceNo?: string | null;
    issuedAt?: Date | null;
}, studentName: string | null, rollNo: string | null): string {
    const typeLabel = cert.type.replace(/_/g, ' ');
    const issued = cert.issuedAt
        ? new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Certificate — ${typeLabel}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; margin: 0; padding: 40px; }
  .cert { max-width: 720px; margin: 0 auto; border: 3px double #1a3670; padding: 48px 56px; text-align: center; }
  .org { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #1a3670; margin-bottom: 4px; }
  .title { font-size: 26px; font-weight: 700; color: #1a3670; margin: 8px 0 24px; text-transform: uppercase; letter-spacing: 1px; }
  .ref { font-size: 12px; color: #666; margin-bottom: 24px; }
  .body { font-size: 15px; line-height: 1.7; margin-bottom: 32px; }
  .name { font-size: 22px; font-weight: 700; margin: 8px 0; }
  .meta { font-size: 13px; color: #444; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 16px; }
</style>
</head>
<body>
  <div class="cert">
    <div class="org">University Campus ERP</div>
    <div class="title">${typeLabel} Certificate</div>
    <div class="ref">Certificate No: ${cert.referenceNo ?? cert.requestNo}</div>
    <div class="body">
      This is to certify that<br />
      <div class="name">${studentName ?? ''}</div>
      ${rollNo ? `<div style="font-size:13px;color:#666;">Roll No: ${rollNo}</div>` : ''}
      has been issued this ${typeLabel.toLowerCase()} certificate.
    </div>
    <div class="meta">
      Issued on: ${issued}<br />
      Request Ref: ${cert.requestNo}
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GET /api/certificates/[id]/download — owner or certificates.manage. Only
// ISSUED certificates can be downloaded. Returns printable HTML.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_request, { user, params }) => {
    try {
        const id = params.id;

        const { cert, studentName, studentRollNo } = await withClient(user, async (db) => {
            const row = await db.certificate.findUnique({ where: { id } });
            if (!row) {
                throw new ApiError(404, 'NOT_FOUND', 'Certificate not found');
            }

            const isManager = await userHasPermission(user, 'certificates.manage');
            const student = isManager ? null : await findSelfStudent(db, user);
            const isOwner = !isManager && student !== null && student.id === row.studentId;
            if (!isManager && !isOwner) {
                throw new ApiError(403, 'FORBIDDEN', 'You can only download your own certificates');
            }
            if (row.status !== 'ISSUED') {
                throw new ApiError(409, 'NOT_ISSUED', 'Only issued certificates can be downloaded');
            }

            let studentName: string | null = null;
            let studentRollNo: string | null = null;
            const stu = isManager
                ? await db.student.findUnique({
                    where: { id: row.studentId },
                    select: { firstName: true, lastName: true, rollNo: true },
                })
                : student;
            if (stu) {
                studentName = `${stu.firstName} ${stu.lastName}`.trim();
                studentRollNo = stu.rollNo;
            }

            return { cert: row, studentName, studentRollNo };
        });

        const html = renderCertificateHtml(cert, studentName, studentRollNo);
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (error) {
        return errorResponse(error);
    }
});
