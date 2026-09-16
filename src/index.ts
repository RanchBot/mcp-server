#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import axios from 'axios';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RanchBotApiClient } from './client';
import { createRanchBotServer, ServerDeps } from './serverFactory';
import { getStdioClient, login, logout } from './stdioClient';
import { getDefaultFarm, setDefaultFarm } from './tools/list_my_farms';

const stdioDeps: ServerDeps = {
  getClient: getStdioClient,
  async resolveDefaultFarm(client) {
    if (getDefaultFarm()) {
      return getDefaultFarm();
    }
    try {
      const farms = await client.getFarms();
      if (farms.farms[0]) {
        setDefaultFarm(farms.farms[0].id);
      }
    } catch {
      // Ignore farm fetch errors; the caller will get a farm-required error.
    }
    return getDefaultFarm();
  },
  async persistDefaultFarm(_client, farmId) {
    setDefaultFarm(farmId);
  },
};

/**
 * Per-request deps for the hosted HTTP path. The API key is captured in the
 * closure; the default farm is read from / written to the key so it survives
 * stateless requests with no server-side session state.
 */
const httpDeps = (apiKey: string): ServerDeps => ({
  async getClient() {
    return new RanchBotApiClient({ accessToken: apiKey });
  },
  async resolveDefaultFarm(client) {
    try {
      const stored = await client.getDefaultFarm();
      if (stored) {
        return stored;
      }
    } catch {
      // Fall through to first-farm default.
    }
    const farms = await client.getFarms();
    return farms.farms[0]?.id ?? null;
  },
  async persistDefaultFarm(client, farmId) {
    await client.setDefaultFarm(farmId);
  },
});

async function runStdioServer() {
  const server = createRanchBotServer(stdioDeps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ranch.Bot MCP server running on stdio');
}

const JSONRPC_ERROR = (code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  error: { code, message },
  id: null,
});

const readJsonBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e: any) {
        reject(e);
      }
    });
    req.on('error', reject);
  });

/**
 * Self-hosted Streamable HTTP transport. It is stateless: each request gets a
 * fresh server and transport. Every request authenticates with a Ranch.Bot API
 * key from the Authorization header; the key is never logged. Deploy behind TLS.
 */
async function runHttpServer() {
  const port = Number(process.env.PORT || '3000');
  const httpServer = createServer(async (req, res) => {
    try {
      const path = (req.url || '').split('?')[0];

      if (req.method === 'GET' && path === '/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (path !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify(JSONRPC_ERROR(-32000, 'Not found. Use POST /mcp.')));
        return;
      }

      // Stateless Streamable HTTP: only POST carries JSON-RPC; GET/DELETE unused.
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json', allow: 'POST' });
        res.end(JSON.stringify(JSONRPC_ERROR(-32000, 'Method not allowed.')));
        return;
      }

      // Authenticate every request. Only the prefix is checked here; the API
      // enforces key validity (and scope) on each tools/call. NOTE: tools/list
      // and initialize never reach the API, so a prefix-only token still reads
      // the tool metadata here — full preflight validation at this layer lands
      // in the #660 hardening PR.
      const [type, token] = (req.headers.authorization || '').split(' ');
      if (type !== 'Bearer' || !token.startsWith('rb_sk_')) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify(
            JSONRPC_ERROR(-32001, 'Unauthorized: a Bearer rb_sk_… API key is required.'),
          ),
        );
        return;
      }

      const parsedBody = await readJsonBody(req);
      const mcpServer = createRanchBotServer(httpDeps(token));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req as IncomingMessage, res as ServerResponse, parsedBody);
      res.on('close', () => {
        transport.close();
        mcpServer.close();
      });
    } catch (error: any) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify(JSONRPC_ERROR(-32603, 'Internal server error')));
      }
    }
  });

  httpServer.listen(port, () => {
    console.error(`Ranch.Bot MCP server (HTTP) listening on port ${port}`);
  });
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--admin');
  if (args.length > 1) throw new Error('Use ranchbot-mcp --help for usage.');
  switch (args[0]) {
    case '--help':
    case '-h':
      console.log(
        'Usage: ranchbot-mcp [login|logout|--help|--version] [--admin]\nNo arguments starts MCP over stdio. Run login in a terminal and explicitly approve browser access.',
      );
      return;
    case '--version':
    case '-v':
      console.log('0.1.0');
      return;
    case 'login':
      await login();
      return;
    case 'logout':
      await logout();
      return;
    case undefined:
      break;
    default:
      throw new Error('Unknown command. Use ranchbot-mcp --help.');
  }

  const transport = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();
  if (transport === 'http') {
    await runHttpServer();
  } else {
    await runStdioServer();
  }
}

main().catch((error) => {
  // Axios errors include request bodies and headers containing credentials.
  const message = axios.isAxiosError(error)
    ? 'Authentication request failed. Check API connectivity and retry. Credentials remain if logout could not be confirmed.'
    : error instanceof Error
      ? error.message
      : 'Unexpected failure. Run ranchbot-mcp --help for usage.';
  console.error(message);
  process.exit(1);
});
