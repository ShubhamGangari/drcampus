// ==============================================================================
// Merit ranking — PURE function (no I/O, no Prisma, no Date.now).
// The tester can unit-test this in isolation. Keeping it free of any I/O or
// mutable external state guarantees the ranking is deterministic and exact.
// ==============================================================================

export interface MeritCandidate {
  id: string;
  marksPercentage: number;
  dob: Date | string;
}

export interface MeritRanked {
  id: string;
  meritRank: number;
}

/**
 * Compute sequential merit ranks (1..n) for a set of applications.
 *
 * Rules:
 *  - Sort by `marksPercentage` descending (higher marks => better rank).
 *  - Tie-break by `dob` ascending (older candidate => better rank).
 *  - Assign sequential ranks 1..n.
 *
 * Ties that remain after both keys (same marks AND same dob) keep their input
 * order (stable sort), which is deterministic for a given input array.
 */
export function computeMeritRanks(applications: MeritCandidate[]): MeritRanked[] {
  const sorted = [...applications].sort((a, b) => {
    if (b.marksPercentage !== a.marksPercentage) {
      return b.marksPercentage - a.marksPercentage;
    }
    // Older candidate has an earlier dob; earlier timestamp ranks higher.
    const aDob = new Date(a.dob).getTime();
    const bDob = new Date(b.dob).getTime();
    return aDob - bDob;
  });

  return sorted.map((app, index) => ({ id: app.id, meritRank: index + 1 }));
}
