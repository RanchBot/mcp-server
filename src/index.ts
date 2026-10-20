#!/usr/bin/env node

import axios from 'axios';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRanchBotServer, ServerDeps } from './serverFactory';
import { getStdioClient, login, logout } from './stdioClient';
import { getDefaultFarm, setDefaultFarm } from './tools/list_my_farms';
import { PACKAGE_VERSION } from './version';

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

async function runStdioServer() {
  const server = createRanchBotServer(stdioDeps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ranch.Bot MCP server running on stdio');
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
      console.log(PACKAGE_VERSION);
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

  await runStdioServer();
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
