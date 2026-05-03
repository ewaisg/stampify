"use client";

// ---------------------------------------------------------------------------
// Shared Firestore utilities
// ---------------------------------------------------------------------------

/**
 * Recursively sanitize a value so it is safe to write to Firestore.
 *
 * - `undefined` and functions are stripped.
 * - `NaN` and `Infinity` / `-Infinity` are converted to `null`.
 * - `null`, `Date`, strings, numbers, and booleans pass through as-is.
 * - Arrays and plain objects are traversed recursively.
 */
export function sanitizeForFirestore(value: unknown): unknown {
  // Primitives & null
  if (value === null) return null;
  if (value === undefined) return undefined; // caller strips undefined keys
  if (typeof value === "function") return undefined;

  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) return null;
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (value instanceof Date) return value;

  // Arrays
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  // Plain objects
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const clean = sanitizeForFirestore(val);
      if (clean !== undefined) {
        sanitized[key] = clean;
      }
    }
    return sanitized;
  }

  return value;
}
