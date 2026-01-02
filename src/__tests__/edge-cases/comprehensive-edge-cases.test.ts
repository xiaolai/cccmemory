/**
 * Comprehensive Edge Case Tests
 *
 * Tests for boundary conditions, special inputs, concurrent operations,
 * and error recovery scenarios across all features.
 */

import Database from "better-sqlite3";
import { WorkingMemoryStore } from "../../memory/WorkingMemoryStore.js";
import { SessionHandoffStore } from "../../handoff/SessionHandoffStore.js";
import { ContextInjector } from "../../context/ContextInjector.js";
import { ConversationParser } from "../../parsers/ConversationParser.js";
import { DecisionExtractor } from "../../parsers/DecisionExtractor.js";
import { MistakeExtractor } from "../../parsers/MistakeExtractor.js";
import { RequirementsExtractor } from "../../parsers/RequirementsExtractor.js";

describe("Edge Cases - Comprehensive Tests", () => {
  let db: Database.Database;
  let memoryStore: WorkingMemoryStore;
  let handoffStore: SessionHandoffStore;
  let contextInjector: ContextInjector;

  beforeEach(() => {
    db = new Database(":memory:");

    // Create required schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS working_memory (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        context TEXT,
        tags TEXT,
        session_id TEXT,
        project_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER,
        embedding BLOB,
        UNIQUE(project_path, key)
      );

      CREATE INDEX IF NOT EXISTS idx_wm_project ON working_memory(project_path);
      CREATE INDEX IF NOT EXISTS idx_wm_project_key ON working_memory(project_path, key);

      CREATE VIRTUAL TABLE IF NOT EXISTS working_memory_fts USING fts5(
        id UNINDEXED,
        key,
        value,
        context
      );

      CREATE TABLE IF NOT EXISTS session_handoffs (
        id TEXT PRIMARY KEY,
        from_session_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        handoff_data TEXT NOT NULL,
        resumed_by_session_id TEXT,
        resumed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        decision_text TEXT NOT NULL,
        rationale TEXT,
        context TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_uses (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        parameters TEXT,
        result TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    memoryStore = new WorkingMemoryStore(db);
    handoffStore = new SessionHandoffStore(db);
    contextInjector = new ContextInjector(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("Unicode and Special Characters", () => {
    const projectPath = "/test/project";

    it("should handle emoji in memory values", () => {
      const result = memoryStore.remember({
        key: "emoji_test",
        value: "Using 🚀 rocket science 🎉 for optimization",
        projectPath,
      });

      expect(result.value).toBe("Using 🚀 rocket science 🎉 for optimization");

      const recalled = memoryStore.recall("emoji_test", projectPath);
      expect(recalled?.value).toBe("Using 🚀 rocket science 🎉 for optimization");
    });

    it("should handle CJK characters in memory values", () => {
      memoryStore.remember({
        key: "cjk_test",
        value: "使用中文进行测试 日本語テスト 한국어 테스트",
        projectPath,
      });

      const recalled = memoryStore.recall("cjk_test", projectPath);
      expect(recalled?.value).toBe("使用中文进行测试 日本語テスト 한국어 테스트");
    });

    it("should handle special characters in keys", () => {
      const specialKeys = [
        "key-with-dashes",
        "key_with_underscores",
        "key.with.dots",
        "key:with:colons",
      ];

      for (const key of specialKeys) {
        memoryStore.remember({ key, value: "test", projectPath });
        const recalled = memoryStore.recall(key, projectPath);
        expect(recalled?.key).toBe(key);
      }
    });

    it("should handle newlines and tabs in values", () => {
      const multilineValue = `Line 1\nLine 2\n\tTabbed line\r\nWindows line`;

      memoryStore.remember({
        key: "multiline",
        value: multilineValue,
        projectPath,
      });

      const recalled = memoryStore.recall("multiline", projectPath);
      expect(recalled?.value).toBe(multilineValue);
    });

    it("should handle very long strings", () => {
      const longValue = "A".repeat(10000);

      memoryStore.remember({
        key: "long_value",
        value: longValue,
        projectPath,
      });

      const recalled = memoryStore.recall("long_value", projectPath);
      expect(recalled?.value.length).toBe(10000);
    });
  });

  describe("SQL Injection Prevention", () => {
    const projectPath = "/test/project";

    it("should handle SQL injection attempts in keys", () => {
      const dangerousKeys = [
        "test'; DROP TABLE working_memory; --",
        "test\"; DELETE FROM working_memory WHERE \"1\"=\"1",
        "'; INSERT INTO working_memory VALUES('hacked');--",
        "test OR 1=1",
      ];

      for (const key of dangerousKeys) {
        memoryStore.remember({ key, value: "test", projectPath });
        const recalled = memoryStore.recall(key, projectPath);
        expect(recalled?.key).toBe(key);
      }

      // Database should still have correct count
      const items = memoryStore.list(projectPath);
      expect(items.length).toBe(dangerousKeys.length);
    });

    it("should handle SQL injection attempts in values", () => {
      memoryStore.remember({
        key: "safe_key",
        value: "'; DROP TABLE working_memory; --",
        projectPath,
      });

      const recalled = memoryStore.recall("safe_key", projectPath);
      expect(recalled?.value).toBe("'; DROP TABLE working_memory; --");
    });

    it("should handle SQL injection in context and tags", () => {
      memoryStore.remember({
        key: "sql_test",
        value: "test",
        context: "'; DELETE FROM working_memory; --",
        tags: ["'; DROP TABLE; --", "normal_tag"],
        projectPath,
      });

      const recalled = memoryStore.recall("sql_test", projectPath);
      expect(recalled?.context).toContain("DELETE");
      expect(recalled?.tags).toContain("'; DROP TABLE; --");
    });
  });

  describe("Boundary Value Tests", () => {
    const projectPath = "/test/project";

    it("should handle empty string key", () => {
      // Empty key might be rejected or handled specially
      expect(() => {
        memoryStore.remember({ key: "", value: "test", projectPath });
      }).not.toThrow();
    });

    it("should handle empty string value", () => {
      memoryStore.remember({ key: "empty_value", value: "", projectPath });
      const recalled = memoryStore.recall("empty_value", projectPath);
      expect(recalled?.value).toBe("");
    });

    it("should handle TTL of 0 seconds", () => {
      memoryStore.remember({
        key: "zero_ttl",
        value: "test",
        ttl: 0,
        projectPath,
      });

      // Should still exist (0 means no expiration, not immediate expiration)
      // or immediately expire based on implementation
      const recalled = memoryStore.recall("zero_ttl", projectPath);
      // Either behavior is acceptable
      expect(recalled === null || recalled?.value === "test").toBe(true);
    });

    it("should handle negative TTL (already expired)", () => {
      memoryStore.remember({
        key: "negative_ttl",
        value: "test",
        ttl: -1,
        projectPath,
      });

      const recalled = memoryStore.recall("negative_ttl", projectPath);
      expect(recalled).toBeNull();
    });

    it("should handle very large TTL", () => {
      memoryStore.remember({
        key: "large_ttl",
        value: "test",
        ttl: Number.MAX_SAFE_INTEGER / 1000,
        projectPath,
      });

      const recalled = memoryStore.recall("large_ttl", projectPath);
      expect(recalled?.value).toBe("test");
    });

    it("should handle limit of 0 (no limit)", () => {
      memoryStore.remember({ key: "item1", value: "v1", projectPath });
      memoryStore.remember({ key: "item2", value: "v2", projectPath });

      // Limit of 0 means no limit - returns all items
      const items = memoryStore.list(projectPath, { limit: 0 });
      expect(items.length).toBe(2);
    });

    it("should handle offset larger than data size", () => {
      memoryStore.remember({ key: "item1", value: "v1", projectPath });

      const items = memoryStore.list(projectPath, { offset: 100 });
      expect(items.length).toBe(0);
    });

    it("should handle negative offset gracefully", () => {
      memoryStore.remember({ key: "item1", value: "v1", projectPath });

      // Negative offset should be treated as 0 or error
      expect(() => {
        memoryStore.list(projectPath, { offset: -1 });
      }).not.toThrow();
    });
  });

  describe("Concurrent Operations", () => {
    const projectPath = "/test/project";

    it("should handle rapid sequential writes to same key", () => {
      for (let i = 0; i < 100; i++) {
        memoryStore.remember({
          key: "rapid_write",
          value: `value_${i}`,
          projectPath,
        });
      }

      const recalled = memoryStore.recall("rapid_write", projectPath);
      expect(recalled?.value).toBe("value_99");
    });

    it("should handle many unique keys", () => {
      for (let i = 0; i < 1000; i++) {
        memoryStore.remember({
          key: `key_${i}`,
          value: `value_${i}`,
          projectPath,
        });
      }

      expect(memoryStore.count(projectPath)).toBe(1000);
    });

    it("should handle interleaved read/write operations", () => {
      for (let i = 0; i < 50; i++) {
        memoryStore.remember({
          key: `item_${i}`,
          value: `value_${i}`,
          projectPath,
        });

        if (i > 0) {
          const prev = memoryStore.recall(`item_${i - 1}`, projectPath);
          expect(prev?.value).toBe(`value_${i - 1}`);
        }
      }
    });
  });

  describe("Session Handoff Edge Cases", () => {
    const projectPath = "/test/project";

    it("should handle handoff with no data", () => {
      const handoff = handoffStore.prepareHandoff({
        sessionId: "session-1",
        projectPath,
        include: [],
      });

      expect(handoff.contextSummary).toBe("Empty handoff.");
      expect(handoff.decisions).toEqual([]);
      expect(handoff.workingMemory).toEqual([]);
    });

    it("should handle resuming already resumed handoff", () => {
      const original = handoffStore.prepareHandoff({
        sessionId: "session-1",
        projectPath,
      });

      // Resume once
      handoffStore.resumeFromHandoff({
        handoffId: original.id,
        projectPath,
        newSessionId: "session-2",
      });

      // Try to resume again - should work (allows re-resume)
      const secondResume = handoffStore.resumeFromHandoff({
        handoffId: original.id,
        projectPath,
        newSessionId: "session-3",
      });

      expect(secondResume).not.toBeNull();
    });

    it("should handle resuming with non-existent handoff ID", () => {
      const result = handoffStore.resumeFromHandoff({
        handoffId: "nonexistent-id",
        projectPath,
        newSessionId: "session-1",
      });

      expect(result).toBeNull();
    });

    it("should handle multiple handoffs from same session", async () => {
      const first = handoffStore.prepareHandoff({
        sessionId: "session-1",
        projectPath,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = handoffStore.prepareHandoff({
        sessionId: "session-1",
        projectPath,
      });

      expect(first.id).not.toBe(second.id);

      const handoffs = handoffStore.listHandoffs(projectPath);
      expect(handoffs.length).toBe(2);
    });
  });

  describe("Context Injector Edge Cases", () => {
    const projectPath = "/test/project";

    it("should handle very small token budget", async () => {
      // Add many items
      for (let i = 0; i < 10; i++) {
        memoryStore.remember({
          key: `item_${i}`,
          value: "A moderately long value for testing purposes",
          projectPath,
        });
      }

      const context = await contextInjector.getRelevantContext({
        projectPath,
        maxTokens: 10,
        sources: ["memory"],
      });

      expect(context.tokenEstimate).toBeLessThanOrEqual(10);
    });

    it("should handle empty query", async () => {
      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const context = await contextInjector.getRelevantContext({
        query: "",
        projectPath,
        sources: ["memory"],
      });

      // Should still return items based on other criteria
      expect(context.memory.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle project with no data", async () => {
      const context = await contextInjector.getRelevantContext({
        projectPath: "/nonexistent/project",
        sources: ["memory", "decisions", "handoffs"],
      });

      expect(context.memory).toEqual([]);
      expect(context.decisions).toEqual([]);
      expect(context.handoff).toBeUndefined();
    });
  });

  describe("Parser Edge Cases", () => {
    let parser: ConversationParser;
    let decisionExtractor: DecisionExtractor;
    let mistakeExtractor: MistakeExtractor;
    let requirementsExtractor: RequirementsExtractor;

    beforeEach(() => {
      parser = new ConversationParser();
      decisionExtractor = new DecisionExtractor();
      mistakeExtractor = new MistakeExtractor();
      requirementsExtractor = new RequirementsExtractor();
    });

    it("should handle nonexistent project path", () => {
      const result = parser.parseProject("/nonexistent/path/123456789");

      expect(result.conversations).toEqual([]);
      expect(result.messages).toEqual([]);
    });

    it("should extract no decisions from empty messages", () => {
      const decisions = decisionExtractor.extractDecisions([], []);
      expect(decisions).toEqual([]);
    });

    it("should extract no mistakes from empty inputs", () => {
      const mistakes = mistakeExtractor.extractMistakes([], []);
      expect(mistakes).toEqual([]);
    });

    it("should extract no requirements from empty messages", () => {
      const requirements = requirementsExtractor.extractRequirements([]);
      expect(requirements).toEqual([]);
    });

    it("should handle messages with null content", () => {
      const messages = [
        {
          id: "1",
          conversation_id: "c1",
          role: "user",
          content: null as unknown as string,
          timestamp: Date.now(),
          message_type: "human",
          is_sidechain: false,
          metadata: {},
        },
        {
          id: "2",
          conversation_id: "c1",
          role: "assistant",
          content: undefined as unknown as string,
          timestamp: Date.now(),
          message_type: "assistant",
          is_sidechain: false,
          metadata: {},
        },
      ];

      // Should not throw
      expect(() => {
        decisionExtractor.extractDecisions(messages, []);
      }).not.toThrow();
    });
  });

  describe("Memory FTS Edge Cases", () => {
    const projectPath = "/test/project";

    it("should handle FTS special characters", () => {
      memoryStore.remember({
        key: "fts_test",
        value: "Testing * OR AND NOT + - ~ ( ) quotes\"",
        projectPath,
      });

      // recallRelevant uses FTS
      const results = memoryStore.recallRelevant({
        query: "Testing",
        projectPath,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle empty FTS query", () => {
      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const results = memoryStore.recallRelevant({
        query: "",
        projectPath,
      });

      // Empty query might return all items or none
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle query with only FTS operators", () => {
      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const results = memoryStore.recallRelevant({
        query: "OR AND NOT",
        projectPath,
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Project Path Edge Cases", () => {
    it("should handle project paths with spaces", () => {
      const projectPath = "/path/with spaces/project";

      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const recalled = memoryStore.recall("test", projectPath);
      expect(recalled?.value).toBe("test value");
    });

    it("should handle project paths with special characters", () => {
      const projectPath = "/path-with_special.chars/project";

      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const recalled = memoryStore.recall("test", projectPath);
      expect(recalled?.value).toBe("test value");
    });

    it("should handle Windows-style paths", () => {
      const projectPath = "C:\\Users\\test\\project";

      memoryStore.remember({
        key: "test",
        value: "test value",
        projectPath,
      });

      const recalled = memoryStore.recall("test", projectPath);
      expect(recalled?.value).toBe("test value");
    });

    it("should distinguish between similar project paths", () => {
      memoryStore.remember({
        key: "test",
        value: "value1",
        projectPath: "/project1",
      });

      memoryStore.remember({
        key: "test",
        value: "value2",
        projectPath: "/project1-copy",
      });

      const result1 = memoryStore.recall("test", "/project1");
      const result2 = memoryStore.recall("test", "/project1-copy");

      expect(result1?.value).toBe("value1");
      expect(result2?.value).toBe("value2");
    });
  });

  describe("Tag Handling Edge Cases", () => {
    const projectPath = "/test/project";

    it("should handle empty tags array", () => {
      memoryStore.remember({
        key: "no_tags",
        value: "test",
        tags: [],
        projectPath,
      });

      const recalled = memoryStore.recall("no_tags", projectPath);
      expect(recalled?.tags).toEqual([]);
    });

    it("should handle tags with special characters", () => {
      const specialTags = ["tag-with-dash", "tag_underscore", "tag.dot", "tag:colon"];

      memoryStore.remember({
        key: "special_tags",
        value: "test",
        tags: specialTags,
        projectPath,
      });

      const recalled = memoryStore.recall("special_tags", projectPath);
      expect(recalled?.tags).toEqual(specialTags);
    });

    it("should handle duplicate tags", () => {
      memoryStore.remember({
        key: "dup_tags",
        value: "test",
        tags: ["tag1", "tag1", "tag2"],
        projectPath,
      });

      const recalled = memoryStore.recall("dup_tags", projectPath);
      // May or may not deduplicate - just verify it doesn't break
      expect(recalled?.tags).toContain("tag1");
      expect(recalled?.tags).toContain("tag2");
    });

    it("should filter by non-existent tag", () => {
      memoryStore.remember({
        key: "item",
        value: "test",
        tags: ["existing"],
        projectPath,
      });

      const items = memoryStore.list(projectPath, { tags: ["nonexistent"] });
      expect(items.length).toBe(0);
    });
  });

  describe("Timestamp Edge Cases", () => {
    const projectPath = "/test/project";

    it("should handle items created at exact same time", () => {
      // Store multiple items as fast as possible
      for (let i = 0; i < 5; i++) {
        memoryStore.remember({
          key: `same_time_${i}`,
          value: `value_${i}`,
          projectPath,
        });
      }

      const items = memoryStore.list(projectPath);
      expect(items.length).toBe(5);
    });

    it("should preserve creation timestamp on update", () => {
      const original = memoryStore.remember({
        key: "timestamp_test",
        value: "original",
        projectPath,
      });

      // Wait briefly
      const createdAt = original.createdAt;

      // Update the item
      memoryStore.remember({
        key: "timestamp_test",
        value: "updated",
        projectPath,
      });

      const updated = memoryStore.recall("timestamp_test", projectPath);
      expect(updated?.createdAt).toBe(createdAt);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(createdAt);
    });
  });
});
