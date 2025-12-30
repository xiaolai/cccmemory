/**
 * Tests for safeJsonParse utility
 */

import { safeJsonParse } from "../../utils/safeJson.js";

describe("safeJsonParse", () => {
  describe("valid JSON", () => {
    it("should parse valid JSON object", () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: "value" });
    });

    it("should parse valid JSON array", () => {
      const result = safeJsonParse("[1, 2, 3]", []);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse valid JSON string", () => {
      const result = safeJsonParse('"hello"', "");
      expect(result).toBe("hello");
    });

    it("should parse valid JSON number", () => {
      const result = safeJsonParse("42", 0);
      expect(result).toBe(42);
    });

    it("should parse valid JSON boolean", () => {
      const result = safeJsonParse("true", false);
      expect(result).toBe(true);
    });

    it("should parse valid JSON null", () => {
      const result = safeJsonParse("null", "default");
      expect(result).toBeNull();
    });
  });

  describe("invalid JSON", () => {
    it("should return fallback for malformed JSON", () => {
      const fallback = { default: true };
      const result = safeJsonParse("{invalid}", fallback);
      expect(result).toBe(fallback);
    });

    it("should return fallback for undefined input", () => {
      const fallback = {};
      const result = safeJsonParse(undefined as unknown as string, fallback);
      expect(result).toBe(fallback);
    });

    it("should return fallback for null input", () => {
      const fallback: string[] = [];
      const result = safeJsonParse(null as unknown as string, fallback);
      expect(result).toBe(fallback);
    });

    it("should return fallback for empty string", () => {
      const fallback = { empty: true };
      const result = safeJsonParse("", fallback);
      expect(result).toBe(fallback);
    });

    it("should return fallback for truncated JSON", () => {
      const fallback: unknown[] = [];
      const result = safeJsonParse('{"key": "val', fallback);
      expect(result).toBe(fallback);
    });

    it("should return fallback for non-string input", () => {
      const fallback = {};
      const result = safeJsonParse(123 as unknown as string, fallback);
      expect(result).toBe(fallback);
    });
  });

  describe("edge cases", () => {
    it("should handle nested objects", () => {
      const json = '{"a": {"b": {"c": 1}}}';
      const result = safeJsonParse(json, {});
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    it("should handle special characters in strings", () => {
      const json = '{"text": "line1\\nline2\\ttab"}';
      const result = safeJsonParse(json, {});
      expect(result).toEqual({ text: "line1\nline2\ttab" });
    });

    it("should handle unicode", () => {
      const json = '{"emoji": "😀", "chinese": "中文"}';
      const result = safeJsonParse(json, {});
      expect(result).toEqual({ emoji: "😀", chinese: "中文" });
    });

    it("should preserve type of fallback", () => {
      const arrayFallback: number[] = [1, 2, 3];
      const result = safeJsonParse("invalid", arrayFallback);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
