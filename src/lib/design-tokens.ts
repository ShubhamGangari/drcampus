/**
 * CampusERP design tokens — single source of truth for the UI system.
 * Keep this file in sync with tailwind.config.ts theme.extend.
 *
 * Palette: indigo (primary), slate (neutral), rose (danger), emerald (success),
 * amber (warning). Light theme only, per AGENTS.md.
 */

export const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      500: "#6366f1",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
    },
    surface: {
      background: "#f8fafc", // slate-50
      card: "#ffffff",
      muted: "#f1f5f9", // slate-100
    },
    success: {
      50: "#f0fdf4",
      100: "#dcfce7",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
    },
    danger: {
      50: "#fef2f2",
      100: "#fee2e2",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
    },
    warning: {
      50: "#fffbeb",
      100: "#fef3c7",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
    },
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  },
  fontFamily: {
    sans: [
      "var(--font-geist-sans)",
      "Inter",
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "sans-serif",
    ] as string[],
  },
  fontSize: {
    "2xs": ["0.6875rem", { lineHeight: "1rem" }] as [string, Record<string, string>],
    xs: ["0.75rem", { lineHeight: "1rem" }] as [string, Record<string, string>],
    sm: ["0.875rem", { lineHeight: "1.25rem" }] as [string, Record<string, string>],
    base: ["1rem", { lineHeight: "1.5rem" }] as [string, Record<string, string>],
    lg: ["1.125rem", { lineHeight: "1.75rem" }] as [string, Record<string, string>],
    xl: ["1.25rem", { lineHeight: "1.75rem" }] as [string, Record<string, string>],
  },
  borderRadius: {
    xs: "0.5rem",
    sm: "0.625rem",
    md: "0.75rem",
    lg: "1rem",
    "2xl": "1.25rem",
  },
  boxShadow: {
    "2xs": "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
    xs: "0 1px 3px 0 rgba(15, 23, 42, 0.1), 0 1px 2px -1px rgba(15, 23, 42, 0.1)",
    sm: "0 2px 6px -1px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.06)",
    md: "0 4px 10px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.05)",
    lg: "0 10px 20px -4px rgba(15, 23, 42, 0.1), 0 4px 10px -4px rgba(15, 23, 42, 0.06)",
  },
  transition: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    default: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

export type DesignToken = typeof DESIGN_TOKENS;
