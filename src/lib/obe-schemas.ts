import { z } from 'zod';

export const createPOSchema = z.object({
  code: z.string().min(1, 'code is required'),
  description: z.string().min(1, 'description is required'),
});

export const createCourseOutcomesSchema = z.object({
  schoolId: z.string().optional(),
  courseId: z.string().min(1, 'courseId is required'),
  cos: z
    .array(
      z.object({
        code: z.string().min(1, 'CO code is required'),
        description: z.string().min(1, 'CO description is required'),
      })
    )
    .min(1, 'At least one CO is required'),
});

export const updateCOSchema = z
  .object({
    code: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .refine((d) => d.code !== undefined || d.description !== undefined, {
    message: 'Provide at least one field to update',
  });

export const createMappingSchema = z.object({
  schoolId: z.string().optional(),
  courseId: z.string().min(1, 'courseId is required'),
  mappings: z
    .array(
      z.object({
        coId: z.string().min(1, 'coId is required'),
        poId: z.string().min(1, 'poId is required'),
        weight: z.number().min(0).max(1),
      })
    )
    .min(1, 'At least one mapping is required'),
});

export const createAttainmentSchema = z.object({
  schoolId: z.string().optional(),
  courseId: z.string().min(1, 'courseId is required'),
  coId: z.string().min(1, 'coId is required'),
  academicYear: z.string().min(1, 'academicYear is required'),
  attainment: z.number().min(0).max(100),
});
