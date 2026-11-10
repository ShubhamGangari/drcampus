# AGENTS.md — CampusERP project rules (har agent ke liye kanoon)

Ye file is project ki sabse upar wali sachhai hai. Har agent, har session, har task se pehle ise padhega. Isse takraane wali koi bhi baat galat hai, chahe kisi ne bhi kahi ho.

## Project kya hai

CampusERP — Drivion Solutions ka college/university ERP (apna khud ka build). College ka poora kaam ek system me: admission se lekar alumni tak. Structure aur workflow bade established ERP products ke module-flow jaisa hai, lekin code, design aur naam 100% apna hai — kisi aur product ka code/design/text copy karna sakht mana hai.

## Tech stack (fix hai, badalna mana hai)

- Next.js (App Router) + TypeScript
- Tailwind CSS — UI premium, simple, light theme, poori English
- Prisma ORM + database (dev me SQLite, production me PostgreSQL)
- Auth: bcrypt + JWT cookie; har query me multi-tenant scoping (`schoolId`)

## Module order (isi kram me banege)

1. Admissions → 2. Student lifecycle → 3. Fees → 4. Examination + Result → 5. OBE (CO-PO mapping) → 6. NAAC/NBA/NIRF reports → 7. Attendance → 8. Hostel → 9. HR/Payroll → 10. Alumni

Ek samay me EK module. Dusra module tabhi shuru hoga jab pehla reviewer + tester dono se pass ho jaye.

## Kaam ka tareeka (koi shortcut nahi)

1. **Spec pehle, code baad me.** Har module/feature ki spec `docs/specs/<module>.md` me pehle banti hai (`erp-module-spec` skill ke format me): goal, screens, API contract, DB changes, acceptance criteria.
2. **API contract freeze.** Spec ka contract architect tay karta hai. Frontend aur backend dono usi ke hisaab se banate hain. Contract badalna ho to architect ke through, dono ko bata kar.
3. **Reviewer alag, tester alag.** Jo banata hai wo apna kaam khud approve nahi karta. Reviewer read-only hai. Tester bina chalaye "pass" nahi kehta.
4. **Har task ke baad git commit.** Chhota, saaf commit message: `module: kya hua` (jaise `fees: add fee-structure CRUD + tests`).
5. **Build green = done ki shart.** `npm run build` fail hai to kaam adhura hai, "done" kehna jhooth hai.

## Sakht mana hai

- Fake/placeholder data ko asli flow me jodna, dead buttons, "baad me karenge" wale TODO ko finished kehna
- Bina tenant scoping (`schoolId`) ke koi query
- Secrets/credentials code me hardcode karna
- Kisi dusre product (MasterSoft ya koi aur) ka code, design, screenshot ya text copy karna — sirf module-structure aur workflow se seekhna allowed hai
- Reviewer ki permission badalna (wo hamesha read-only rahega)

## Quality bar

- Har form: validation + loading + empty + error state
- Har calculation (fees, percentage, result): pure function + tester ka test lazmi
- UI: ek hi design system (ui-ux-pro-max se bana hua), har screen usi palette/typography par
