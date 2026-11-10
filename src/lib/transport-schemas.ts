// ==============================================================================
// Zod schemas for the Transport Management API contract (Batch A).
// Mirrors docs/specs/transport.md §4. `schoolId` is optional on create bodies
// because school-scoped users never send it; central officers (schoolId 'ALL')
// must send it to select a target tenant.
// ==============================================================================

import { z } from 'zod';

export const VEHICLE_TYPES = ['BUS', 'VAN'] as const;
export const VEHICLE_STATUSES = ['ACTIVE', 'MAINTENANCE'] as const;
export const PASS_STATUSES = ['ACTIVE', 'EXPIRED', 'PENDING'] as const;

// ---- Route stops (ordered list of named stops) -------------------------------

export const routeStopSchema = z.object({
    name: z.string().min(1, 'stop name is required').max(120),
    order: z.number().int().min(0),
    time: z.string().max(10).optional().nullable(),
});

// ---- Routes ------------------------------------------------------------------

export const createRouteSchema = z.object({
    schoolId: z.string().optional(),
    name: z.string().min(1, 'route name is required').max(200),
    stops: z.array(routeStopSchema).min(1, 'at least one stop is required').max(100),
    distanceKm: z.number().min(0).optional().nullable(),
});

export const updateRouteSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    stops: z.array(routeStopSchema).min(1).max(100).optional(),
    distanceKm: z.number().min(0).optional().nullable(),
    active: z.boolean().optional(),
    schoolId: z.string().optional(),
});

// ---- Vehicles ----------------------------------------------------------------

export const createVehicleSchema = z.object({
    schoolId: z.string().optional(),
    registrationNo: z.string().min(1, 'registration number is required').max(40),
    type: z.enum(VEHICLE_TYPES, { error: 'type must be BUS or VAN' }).default('BUS'),
    capacity: z.number().int().min(1, 'capacity must be at least 1').max(200),
    routeId: z.string().optional().nullable(),
    status: z.enum(VEHICLE_STATUSES, { error: 'status must be ACTIVE or MAINTENANCE' }).default('ACTIVE'),
});

export const updateVehicleSchema = z.object({
    registrationNo: z.string().min(1).max(40).optional(),
    type: z.enum(VEHICLE_TYPES).optional(),
    capacity: z.number().int().min(1).max(200).optional(),
    routeId: z.string().optional().nullable(),
    status: z.enum(VEHICLE_STATUSES).optional(),
    schoolId: z.string().optional(),
});

// ---- Passes ------------------------------------------------------------------

export const createPassSchema = z.object({
    schoolId: z.string().optional(),
    studentId: z.string().min(1, 'studentId is required'),
    routeId: z.string().min(1, 'routeId is required'),
    stop: z.string().min(1, 'stop is required').max(120),
    validTo: z.string().datetime({ offset: true }), // ISO instant
    fee: z.number().min(0, 'fee cannot be negative'),
});

export const updatePassSchema = z.object({
    status: z.enum(PASS_STATUSES).optional(),
    schoolId: z.string().optional(),
});
