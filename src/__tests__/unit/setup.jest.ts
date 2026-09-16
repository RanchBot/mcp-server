// Jest setup for mcp-server unit tests
// Use this file to configure any global test behavior (e.g. env vars)

process.env.RANCHBOT_API_URL = process.env.RANCHBOT_API_URL ?? 'http://localhost:7001';
process.env.API_VERSION = process.env.API_VERSION ?? 'v1';
