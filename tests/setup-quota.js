// Test-only seeding: create a low-intake program so QUOTA_FULL is triggerable
// with a single allocation. Does NOT touch feature code.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const prog = await p.program.upsert({
    where: { id: 'prog_test_quota' },
    update: { currentIntake: 1 },
    create: {
      id: 'prog_test_quota',
      schoolId: 'sch_eng',
      name: 'TEST Quota Program (intake 1)',
      code: 'TEST-QUOTA',
      durationYears: 1,
      totalSemesters: 2,
      degreeType: 'UG',
      currentIntake: 1,
    },
  });
  console.log('Setup: test quota program ready, intake =', prog.currentIntake);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
