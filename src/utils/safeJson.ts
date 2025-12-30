/**
 * Safe JSON parsing utilities
 *
 * Provides crash-safe JSON parsing with fallback values.
 * Use this instead of raw JSON.parse() when parsing data from:
 * - Database rows (may be corrupted)
 * - User input
 * - External sources
 */

/**
 * Safely parse JSON with a fallback value on error.
 *
 * Unlike JSON.parse(), this function:
 * - Never throws
 * - Handles null/undefined input
 * - Handles non-string input
 * - Returns the fallback on any parse error
 *
 * @param value - The JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed value or fallback
 *
 * @example
 * ```typescript
 * // Safe object parsing
 * const data = safeJsonParse(row.metadata, {});
 *
 * // Safe array parsing
 * const files = safeJsonParse(row.files_changed, []);
 *
 * // With specific type
 * interface Config { debug: boolean }
 * const config = safeJsonParse<Config>(jsonStr, { debug: false });
 * ```
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  // Handle non-string input
  if (typeof value !== "string" || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
}
