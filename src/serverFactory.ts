import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { RanchBotApiClient } from './client';
import { SERVER_INSTRUCTIONS } from './serverInstructions';
import { getToolHandlerPath } from './toolRegistry';
import { registerTools } from './tools';
import { PACKAGE_VERSION } from './version';
import { toolInputSchemas } from './tools/_shared/toolInputSchemas';

/**
 * Tools that are not farm-scoped: they work across farms (or, for the admin
 * import tools, an admin account may have no farms of its own).
 */
const FARM_EXEMPT_TOOLS = [
  'list_my_farms',
  'set_default_farm',
  'get_current_context', // user/key context — not farm-scoped
  'list_pending_imports',
  'get_import_request',
  'update_import_request_status',
];

/**
 * How a running server obtains an API client and resolves the default farm.
 * Kept as a dependency so the same tool surface serves both transports:
 *   - stdio: one user per process; device-flow auth + an in-memory default farm.
 *   - http:  stateless (one request per tool call); the key from the
 *            `Authorization` header + a default farm bound to that API key, so
 *            it survives across requests and sessions with no server-side state.
 */
export interface ServerDeps {
  getClient(): Promise<RanchBotApiClient>;
  resolveDefaultFarm(client: RanchBotApiClient): Promise<string | null>;
  persistDefaultFarm(client: RanchBotApiClient, farmId: string): Promise<void>;
}

/**
 * Build the MCP `Server` (tool list + call handler) shared by both transports.
 * All auth and default-farm mechanics are injected via {@link ServerDeps}, so
 * this file has no process-global state — the multi-tenancy hazard of the old
 * module-level token/farm variables lives only in the stdio entrypoint.
 */
export const createRanchBotServer = (deps: ServerDeps): Server => {
  const server = new Server(
    { name: 'ranchbot-mcp-server', version: PACKAGE_VERSION },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registerTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    let args = request.params.arguments;
    const toolPath = getToolHandlerPath(name);
    if (!toolPath) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
    }

    const schema = toolInputSchemas[name];
    if (schema) {
      const parsed = schema.safeParse(args ?? {});
      if (!parsed.success) {
        throw new McpError(ErrorCode.InvalidParams, parsed.error.message);
      }
      args = parsed.data;
    }

    // Context changes require an explicit validated target, never the saved default.
    const defaultTarget = name === 'set_default_farm' ? (args?.farm_id as string) : undefined;

    let client: RanchBotApiClient;
    try {
      client = await deps.getClient();
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to authenticate: ${error.message}`);
    }

    // Effective farm: explicit arg wins, else the stored default.
    const farmId =
      defaultTarget || (args?.farm_id as string) || (await deps.resolveDefaultFarm(client));

    if (!farmId && !FARM_EXEMPT_TOOLS.includes(name)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Farm ID is required. Use list_my_farms to see available farms, or set_default_farm to set a default.',
      );
    }

    // Persist a new default when the caller sets one (stdio: in-memory; http: on
    // the API key, so it survives stateless requests).
    if (defaultTarget) {
      try {
        await deps.persistDefaultFarm(client, defaultTarget);
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, `Failed to set default farm: ${error.message}`);
      }
    }

    try {
      const { handleTool } = await import(toolPath);
      const result = await handleTool(client, farmId || '', args || {});
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error.message}`);
    }
  });

  return server;
};
