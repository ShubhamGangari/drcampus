// ==============================================================================
// Zod schemas for the Alumni Management API contract (Module 10).
// `schoolId` is optional on create bodies because school-scoped users never send
// it; central officers (schoolId 'ALL') must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const createAlumniSchema = z.object({
  schoolId: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  email: z.string().email('valid email is required'),
  phone: z.string().optional(),
  currentCompany: z.string().optional(),
  batch: z.string().optional(),
});

export const updateAlumniSchema = z.object({
  email: z.string().email('valid email is required').optional(),
  phone: z.string().optional(),
  currentCompany: z.string().optional(),
  batch: z.string().optional(),
});

export const createEventSchema = z.object({
  schoolId: z.string().optional(),
  title: z.string().min(1, 'title is required').max(200),
  date: z.string().min(1, 'date is required'),
  location: z.string().optional(),
});

export const createDonationSchema = z.object({
  schoolId: z.string().optional(),
  amount: z.number(),
  mode: z.string().min(1, 'mode is required'),
});
