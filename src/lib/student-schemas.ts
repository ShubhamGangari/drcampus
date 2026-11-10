// ==============================================================================
// Zod schemas for the Student Lifecycle API contract (Module 2).
// ==============================================================================

import { z } from 'zod';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const createStudentSchema = z.object({
  admissionId: z.string().optional(),
  programId: z.string().min(1),
  batchId: z.string().min(1),
  schoolId: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.email(),
  phone: z.string().min(10).max(20),
  dob: z.string().regex(ISO_DATE_RE, 'dob must be an ISO date (YYYY-MM-DD)'),
  gender: z.string().min(1),
  category: z.string().min(1),
});

export const updateStudentSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.email().optional(),
    phone: z.string().min(10).max(20).optional(),
    status: z.enum(['ACTIVE', 'ON_LEAVE', 'GRADUATED', 'DROPPED', 'TRANSFERRED']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided',
  });

export const enrollStudentSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  semester: z.number().int().min(1).max(12),
  schoolId: z.string().optional(),
});

export const leaveRequestSchema = z
  .object({
    type: z.string().min(1).max(100),
    fromDate: z.string().regex(ISO_DATE_RE, 'fromDate must be an ISO date (YYYY-MM-DD)'),
    toDate: z.string().regex(ISO_DATE_RE, 'toDate must be an ISO date (YYYY-MM-DD)'),
    reason: z.string().min(1).max(1000),
  })
  .refine((d) => d.fromDate <= d.toDate, {
    message: 'fromDate must be on or before toDate',
  });

export const graduateStudentSchema = z.object({
  graduationDate: z.string().regex(ISO_DATE_RE, 'graduationDate must be an ISO date (YYYY-MM-DD)').optional(),
  degreeAwarded: z.string().max(200).optional(),
});

export const transferRequestSchema = z.object({
  toProgramId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const reviewStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().max(500).optional(),
});
