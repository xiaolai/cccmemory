/**
 * Claude Conversation Memory - MCP Server
 * MCP server implementation with stdio transport
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ConversationMemory } from "./ConversationMemory.js";
import { ToolHandlers } from "./tools/ToolHandlers.js";
import { TOOLS } from "./tools/ToolDefinitions.js";
import { getSQLiteManager } from "./storage/SQLiteManager.js";

/**
 * Main MCP Server
 */
export class ConversationMemoryServer {
  private server: Server;
  private memory: ConversationMemory;
  private handlers: ToolHandlers;

  constructor() {
    this.server = new Server(
      {
        name: "claude-conversation-memory",
        version: "1.4.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.memory = new ConversationMemory();
    this.handlers = new ToolHandlers(this.memory, getSQLiteManager());

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(TOOLS),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      // Ensure args is always an object, defaulting to empty
      const argsObj = (args ?? {}) as Record<string, unknown>;

      try {
        console.error(`[MCP] Executing tool: ${name}`);

        let result: unknown;

        switch (name) {
          case "index_conversations":
            result = await this.handlers.indexConversations(argsObj);
            break;

          case "search_conversations":
            result = await this.handlers.searchConversations(argsObj);
            break;

          case "get_decisions":
            result = await this.handlers.getDecisions(argsObj);
            break;

          case "check_before_modify":
            result = await this.handlers.checkBeforeModify(argsObj);
            break;

          case "get_file_evolution":
            result = await this.handlers.getFileEvolution(argsObj);
            break;

          case "link_commits_to_conversations":
            result = await this.handlers.linkCommitsToConversations(argsObj);
            break;

          case "search_mistakes":
            result = await this.handlers.searchMistakes(argsObj);
            break;

          case "get_requirements":
            result = await this.handlers.getRequirements(argsObj);
            break;

          case "get_tool_history":
            result = await this.handlers.getToolHistory(argsObj);
            break;

          case "find_similar_sessions":
            result = await this.handlers.findSimilarSessions(argsObj);
            break;

          case "recall_and_apply":
            result = await this.handlers.recallAndApply(argsObj);
            break;

          case "generate_documentation":
            result = await this.handlers.generateDocumentation(argsObj);
            break;

          case "discover_old_conversations":
            result = await this.handlers.discoverOldConversations(argsObj);
            break;

          case "migrate_project":
            result = await this.handlers.migrateProject(argsObj);
            break;

          case "forget_by_topic":
            result = await this.handlers.forgetByTopic(argsObj);
            break;

          case "index_all_projects":
            result = await this.handlers.indexAllProjects(argsObj);
            break;

          case "search_all_conversations":
            result = await this.handlers.searchAllConversations(argsObj);
            break;

          case "get_all_decisions":
            result = await this.handlers.getAllDecisions(argsObj);
            break;

          case "search_all_mistakes":
            result = await this.handlers.searchAllMistakes(argsObj);
            break;

          default:
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: `Unknown tool: ${name}` }),
                },
              ],
              isError: true,
            };
        }

        // Use compact JSON for responses (no pretty-printing)
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error: unknown) {
        // Safely handle non-Error throws
        const err = error instanceof Error ? error : new Error(String(error));
        // Log full error details server-side only
        console.error(`[MCP] Error executing tool ${name}:`, err.message);
        if (err.stack) {
          console.error(`[MCP] Stack trace:`, err.stack);
        }

        // SECURITY: Return only error message to client, not stack traces
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: err.message }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Start the server
   */
  async start() {
    const transport = new StdioServerTransport();

    console.error("[MCP] Claude Conversation Memory Server starting...");
    console.error(`[MCP] Database: ${getSQLiteManager().getStats().dbPath}`);

    await this.server.connect(transport);

    console.error("[MCP] Server ready - listening on stdio");
  }
}
