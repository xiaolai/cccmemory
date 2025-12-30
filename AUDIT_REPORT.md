# Audit Report

**Date**: 2025-12-30
**Scope**: Entire codebase (43 source files)
**Version**: 1.7.4

## Executive Summary

**Overall Risk Score**: High

| Dimension | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| 1. Redundant Code | 0 | 0 | 1 | 1 |
| 2. Security | 0 | 1 | 4 | 3 |
| 3. Correctness | 1 | 5 | 12 | 4 |
| 4. Compliance | 0 | 0 | 0 | 0 |
| 5. Maintainability | 0 | 0 | 3 | 0 |
| 6. Performance | 0 | 2 | 6 | 0 |
| 7. Testing | 0 | 1 | 2 | 0 |
| 8. Dependencies | 0 | 1 | 1 | 0 |
| 9. Documentation | 0 | 0 | 1 | 2 |

**Verdict**: NEEDS WORK

## Critical Issues (Immediate Action Required)

| File:Line | Dimension | Issue | Fix |
|-----------|-----------|-------|-----|
| ConversationStorage.ts:151 | Correctness | `INSERT OR REPLACE` with FKs can cascade deletes and cause data loss on crash | Use `INSERT ... ON CONFLICT DO UPDATE` (UPSERT) |
| migrations.ts:107 | Correctness | Migration SQL splitting drops statements with `--` comments, skipping critical DDL | Use `db.exec(migration.up)` directly without splitting |

## High Severity Issues

| File:Line | Dimension | Issue | Fix |
|-----------|-----------|-------|-----|
| ToolHandlers.ts:91 | Correctness | `maybeAutoIndex()` can stampede (concurrent calls before timestamp updates) | Add mutex/promise to coalesce calls |
| ToolHandlers.ts:413 | Performance | Auto-index on read paths can turn queries into long indexing operations | Make opt-in, cap work, or run async |
| ToolHandlers.ts:1145 | Security | `getToolHistory` defaults `include_content=true`, exposing secrets | Default to `false` |
| ToolHandlers.ts:1225 | Correctness | `JSON.parse` on tool_input can crash entire tool on malformed data | Use `safeJsonParse` helper |
| ToolHandlers.ts:2177 | Correctness | DB handles leak on exception in `indexAllProjects` | Wrap in try/finally |
| ToolHandlers.ts:2308 | Correctness | Per-project DB not closed on inner try throw | Add finally block |
| ConversationStorage.ts:292 | Performance | FTS rebuild on every `storeMessages` call causes write amplification | Rebuild once per indexing run |
| ConversationStorage.ts:533 | Performance | FTS rebuild on every `storeDecisions` call | Same fix |
| ConversationParser.ts:409 | Performance | `readFileSync` loads entire JSONL into memory | Stream line-by-line |
| SemanticSearch.ts:230 | Performance | Decision search loads ALL embeddings into JS (O(n) scan) | Use sqlite-vec ANN/KNN |
| ConversationMemory.ts:164 | Security | `includeThinking` defaults to true when undefined, indexing sensitive data | Default to `false` |
| VectorStore.ts:214 | Correctness | Stores hardcoded model name ignoring actual provider | Pass actual model info |
| EmbeddingGenerator.ts:50 | Correctness | Provider init failures abort instead of falling back | Wrap in try/catch with fallback |
| cli/commands.ts:1160 | Correctness | Uses `require()` in ESM project, will throw at runtime | Use `await import()` |
| package.json | Dependencies | `@modelcontextprotocol/sdk` has high severity vulnerability (DNS rebinding) | Run `npm audit fix` |

## Medium Severity Issues

| File:Line | Dimension | Issue | Fix |
|-----------|-----------|-------|-----|
| ToolHandlers.ts:151 | Correctness | `isCurrentProject` uses substring match, can false-match | Compare normalized paths |
| ToolHandlers.ts:453 | Correctness | Global search silently ignores project failures | Return errors in response |
| ToolHandlers.ts:904 | Correctness | `JSON.parse` can crash on corrupted DB rows | Use `safeJsonParse` |
| ToolHandlers.ts:1013 | Correctness | Same `JSON.parse` crash risk | Use `safeJsonParse` |
| ToolHandlers.ts:1838 | Security | `migrateProject` accepts paths without validation | Validate paths under expected dir |
| ToolHandlers.ts:138 | Redundant | Duplicates logic from `ConversationMemory.indexConversations` | Refactor to single source |
| ConversationStorage.ts:174 | Performance | Cache cleared repeatedly in loop (O(n²)) | Clear once per batch |
| ConversationStorage.ts:564 | Correctness | `JSON.parse` without try/catch | Use `safeJsonParse` |
| ConversationStorage.ts:630 | Correctness | `JSON.parse` without try/catch | Use `safeJsonParse` |
| SQLiteManager.ts:20 | Dependencies | 30GB MMAP_SIZE problematic on constrained systems | Make configurable |
| SQLiteManager.ts:507 | Correctness | Singleton ignores subsequent configs | Key by dbPath or remove singleton |
| ConversationParser.ts:223 | Correctness | Empty HOME causes wrong directory indexing | Require HOME, throw if missing |
| ConversationParser.ts:418 | Correctness | Bad JSON lines silently skipped without tracking | Track bad_lines_count |
| ConversationParser.ts:463 | Correctness | NaN timestamps break sort | Filter out NaN explicitly |
| SemanticSearch.ts:327 | Performance | N+1 queries for conversation data | Use joined columns directly |
| SemanticSearch.ts:337 | Correctness | `JSON.parse` can throw | Use `safeJsonParse` |
| SemanticSearch.ts:371 | Correctness | Missing conversation throws, fails entire search | Skip bad rows, return errors |
| ConversationMemory.ts:150 | Maintainability | Long orchestrator without transaction | Wrap in DB transaction |
| DeletionService.ts:227 | Security | FTS query from raw keywords, can be manipulated | Escape FTS operators |
| DeletionService.ts:154 | Performance | Deletion doesn't purge vec tables | Delete from vec tables too |
| GlobalIndex.ts:82 | Correctness | Constructor has side effects, can throw during import | Lazy-initialize |
| GlobalIndex.ts:128 | Correctness | SELECT then INSERT/UPDATE race condition | Use UPSERT |
| BackupManager.ts:146 | Security | Backups with default permissions expose sensitive data | Write with 0o600 |
| BackupManager.ts:261 | Correctness | Comment says backups include embeddings but they don't | Update docs or include |
| VectorStore.ts:34 | Correctness | Vec detection mutates DB, can fail read-only | Use non-mutating probe |
| VectorStore.ts:134 | Correctness | Dimension changes silently break vec inserts | Track and handle dimension mismatch |
| VectorStore.ts:300 | Performance | Cosine fallback loads ALL embeddings | Stream top-N |
| VectorStore.ts:364 | Correctness | Bad embedding returns empty vector causing crash | Return null, skip invalid |
| EmbeddingGenerator.ts:99 | Correctness | autoDetectProvider assumes init won't throw | Add try/catch |
| cli/commands.ts:347 | Correctness | reindex deletes without transaction | Wrap in transaction |
| cli/commands.ts:615 | Correctness | reset deletes without transaction | Wrap in transaction |
| mcp-server.ts:29 | Maintainability | Hardcoded version diverges from package.json | Read from package.json |
| mcp-server.ts:67 | Maintainability | Manual tool dispatch can drift | Use name→handler map |

## Low Severity Issues

| File:Line | Dimension | Issue | Fix |
|-----------|-----------|-------|-----|
| ToolHandlers.ts:883 | Correctness | LIKE query without escaping wildcards | Use sanitizeForLike |
| ToolHandlers.ts:2 | Documentation | Header claims "13 tools" but more exist | Update comment |
| ConversationMemory.ts:210 | Correctness | Git error logs raw error object | Log error.message |
| SemanticSearch.ts:13 | Redundant | `has_decisions` filter defined but never used | Implement or remove |
| DeletionService.ts:221 | Observability | Uses console.error directly | Use Logger |
| ProjectMigration.ts:75 | Correctness | No directory check before probing entries | Add isDirectory check |
| ProjectMigration.ts:433 | Correctness | DETACH inside try, unnecessary rollback | Move to finally |
| ProjectMigration.ts:482 | Correctness | Path split only on `/`, breaks Windows | Use path utilities |
| sanitization.ts:24 | Correctness | Rejects any string with `..` (false positives) | Check path segments |
| sanitization.ts:44 | Security | Incomplete Unix forbidden list | Define explicit allowlist |
| sanitization.ts:112 | Security | validateDatabasePath allows unexpected locations | Require absolute + allowed parent |
| Logger.ts:133 | UX | LOG_LEVEL case-sensitive | Normalize to uppercase |
| index.ts:52 | UX | Auto-selects MCP mode in piped contexts | Require explicit --server |
| index.ts:100 | Security | Fatal handler logs full stack traces | Gate behind debug level |

## Testing Gaps

| File:Line | Issue |
|-----------|-------|
| ToolHandlers.ts:91 | No test for auto-index stampede prevention |
| ConversationMemory.ts:164 | No test for default includeThinking behavior (privacy regression risk) |
| SemanticSearch.ts:230 | No performance test for O(n) embedding scans |

## Dependency Issues

| Package | Current | Latest | Issue |
|---------|---------|--------|-------|
| @modelcontextprotocol/sdk | 1.23.0 | 1.25.1 | **High: DNS rebinding vulnerability** |
| better-sqlite3 | 11.10.0 | 12.5.0 | Major version behind |
| commander | 12.1.0 | 14.0.2 | Major version behind |
| jest | 29.7.0 | 30.2.0 | Major version behind |

## Top Priority Actions

1. **[Critical]** Fix `INSERT OR REPLACE` cascade issue - `ConversationStorage.ts:151`
2. **[Critical]** Fix migration SQL splitting - `migrations.ts:107`
3. **[High]** Fix MCP SDK vulnerability - Run `npm audit fix`
4. **[High]** Add mutex to prevent auto-index stampede - `ToolHandlers.ts:91`
5. **[High]** Default `include_content=false` in getToolHistory - `ToolHandlers.ts:1145`
6. **[High]** Default `includeThinking=false` - `ConversationMemory.ts:164`
7. **[High]** Fix ESM `require()` error - `cli/commands.ts:1160`
8. **[High]** Add safeJsonParse helper and use throughout codebase
9. **[High]** Fix DB handle leaks in indexAllProjects - `ToolHandlers.ts:2177,2308`
10. **[High]** Optimize FTS rebuilds - `ConversationStorage.ts:292,533`

## Positive Observations

- ✅ TypeScript strict mode enabled with zero lint warnings policy
- ✅ Comprehensive JSDoc documentation on public APIs
- ✅ Good separation of concerns (parsers, storage, search, tools)
- ✅ Incremental indexing support with lastIndexedMs parameter
- ✅ Multiple embedding provider support (Transformers.js, Ollama, OpenAI)
- ✅ Semantic search with vector embeddings and FTS fallback
- ✅ Cross-project search capability via GlobalIndex
- ✅ Git integration for commit linking
- ✅ Project migration/merge support
- ✅ Backup/restore functionality
- ✅ CLI and MCP server dual mode

---
*Generated by Codex Audit*
