import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['FACULTY', 'FINANCE_OFFICER', 'EXAM_CONTROLLER', 'DEAN', 'STUDENT', 'REGISTRAR_ADMIN']),
  schoolId: z.string(),
});

export const admissionCycleSchema = z.object({
  title: z.string().min(3),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  active: z.boolean().default(true),
});

export const applicationSchema = z.object({
  cycleId: z.string(),
  programId: z.string(),
  applicantName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  gender: z.string(),
  dob: z.string().transform((val) => new Date(val)),
  category: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS']),
  marksPercentage: z.number().min(0).max(100),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
});

// Public applicant submission: same as `applicationSchema` plus the schoolId the
// applicant is applying to (resolved as tenant scope since there is no auth).
export const publicApplicationSchema = applicationSchema.extend({
  schoolId: z.string().min(1),
});

// Merit list generation request body.
export const generateMeritSchema = z.object({
  cycleId: z.string(),
  programId: z.string(),
  formula: z.literal('MARKS_PERCENTAGE'),
});

// Seat allocation request body.
export const allocateSeatSchema = z.object({
  applicationId: z.string(),
  programId: z.string(),
  quotaCategory: z.string(),
});

// Merit list publish request body.
export const publishMeritSchema = z.object({
  cycleId: z.string().min(1),
  programId: z.string().min(1),
});

// --- Academic Governance & Organizational Structure (Module: org-structure) ---

export const createDepartmentSchema = z.object({
  schoolId: z.string().min(1).optional(),
  name: z.string().min(1),
  code: z.string().min(1).max(20),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(20).optional(),
});

export const setDepartmentHeadSchema = z.object({
  headUserId: z.string().nullable(),
});

export const setUserDepartmentSchema = z.object({
  departmentId: z.string().min(1),
  position: z.string().nullable().optional(),
});

export const setUserPositionSchema = z.object({
  position: z.string().nullable(),
});

export const setProgramCoordinatorSchema = z.object({
  coordinatorUserId: z.string().min(1),
});

export const createClassGroupSchema = z.object({
  schoolId: z.string().min(1).optional(),
  programId: z.string().min(1),
  batchId: z.string().min(1),
  section: z.string().min(1),
});

export const setClassCoordinatorSchema = z.object({
  coordinatorUserId: z.string().min(1),
});

export const createAllocationSchema = z.object({
  schoolId: z.string().min(1).optional(),
  courseId: z.string().min(1),
  classGroupId: z.string().min(1),
  facultyUserId: z.string().min(1),
  semester: z.number().int().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  departmentId: z.string().nullable().optional(),
});
