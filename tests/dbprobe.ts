import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const st = await p.student.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, schoolId: true },
  });
  const pr = await p.program.findMany({
    select: { id: true, schoolId: true, name: true },
  });
  const inv = await p.invoice.findMany({
    select: { id: true, studentId: true, structureId: true, amount: true, status: true },
  });
  const fs = await p.feeStructure.findMany({
    select: { id: true, programId: true, schoolId: true, academicYear: true, semester: true, totalAmount: true },
  });
  console.log('STUDENTS', JSON.stringify(st, null, 2));
  console.log('PROGRAMS', JSON.stringify(pr, null, 2));
  console.log('INVOICES', JSON.stringify(inv, null, 2));
  console.log('FEE_STRUCTURES', JSON.stringify(fs, null, 2));
})().finally(() => p.$disconnect());
