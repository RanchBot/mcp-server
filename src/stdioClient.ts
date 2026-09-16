import { setDefaultFarm } from './tools/list_my_farms';
import { IS_LOCAL, RANCHBOT_API_URL } from './config';
import { loadLocalSession } from './localSession';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { initiateDeviceFlow, pollForToken, refreshAccessToken, revokeRefreshToken } from './auth';
import { RanchBotApiClient } from './client';
import {
  clearTokens,
  isTokenExpired,
  loadTokens,
  storeTokens,
  withTokenLock,
} from './tokenStorage';

let accessToken: string | null = null;
let apiClient: RanchBotApiClient | null = null;
let clientResolution: Promise<RanchBotApiClient> | null = null;

const principal = (token: string | null): string | null => {
  try {
    const claims = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString());
    return typeof claims.sub === 'string' ? `${claims.iss || ''}:${claims.sub}` : null;
  } catch {
    return null;
  }
};

const useAccessToken = (token: string) => {
  if (!apiClient || accessToken !== token) {
    if (!principal(token) || principal(token) !== principal(accessToken)) setDefaultFarm(null);
    accessToken = token;
    apiClient = new RanchBotApiClient({ accessToken });
  }
  return apiClient;
};

const authenticationRequired = (error: unknown) =>
  new McpError(
    ErrorCode.InvalidRequest,
    `Authentication required. Run ranchbot-mcp login in your terminal, approve access in your browser, then retry. ${error instanceof Error ? error.message : ''}`,
  );

async function resolveStdioClient(): Promise<RanchBotApiClient> {
  if (IS_LOCAL) {
    const session = loadLocalSession(RANCHBOT_API_URL);
    if (!session)
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Sign in from your terminal: ranchbot login --local --api-url <installation>. Never send passwords through MCP.',
      );
    return useAccessToken(session.access_token);
  }
  try {
    // Another process can replace/revoke an unexpired session. Read under its write lock.
    const storedClient = await withTokenLock(async () => {
      const current = loadTokens();
      if (current && !isTokenExpired(current)) {
        return useAccessToken(current.access_token);
      }
      if (!current?.refresh_token) return null;

      try {
        const tokens = await refreshAccessToken(current.refresh_token);
        storeTokens({ ...tokens, scope: tokens.scope ?? current.scope });
        return useAccessToken(tokens.access_token);
      } catch (error) {
        if (loadTokens()?.refresh_token === current.refresh_token) clearTokens();
        throw error;
      }
    });
    if (storedClient) return storedClient;
  } catch (error) {
    throw authenticationRequired(error);
  }

  throw authenticationRequired(null);
}

export async function login(): Promise<RanchBotApiClient> {
  if (IS_LOCAL)
    throw new Error(
      'Use ranchbot login --local --api-url <installation> for installation-local authentication.',
    );
  await withTokenLock(async () => {
    loadTokens();
  });
  const deviceCode = await initiateDeviceFlow();
  console.error('\n=== Ranch.Bot MCP Server Authentication ===');
  console.error(`\nPlease visit: ${deviceCode.verification_uri_complete}`);
  console.error(`\nOr enter this code: ${deviceCode.user_code}`);
  console.error(`\nWaiting for authorization...\n`);

  const tokens = await pollForToken(deviceCode.device_code, deviceCode.interval);
  const authenticatedClient = await withTokenLock(async () => {
    const current = loadTokens();
    if (current?.refresh_token) await revokeRefreshToken(current.refresh_token);
    storeTokens(tokens);
    return useAccessToken(tokens.access_token);
  });
  console.error('✓ Authentication successful!\n');
  return authenticatedClient;
}

export async function getStdioClient(): Promise<RanchBotApiClient> {
  if (!clientResolution) {
    clientResolution = resolveStdioClient().finally(() => {
      clientResolution = null;
    });
  }
  return clientResolution;
}

export const resetStdioClientForTests = () => {
  accessToken = null;
  apiClient = null;
  clientResolution = null;
};

export async function logout(): Promise<void> {
  if (IS_LOCAL)
    throw new Error(
      'Use ranchbot logout --local --api-url <installation> for installation-local authentication.',
    );
  await withTokenLock(async () => {
    const current = loadTokens(true);
    if (!current) return;
    if (!current.refresh_token)
      throw new Error(
        'Cannot revoke this cache: refresh token missing. Credentials were retained.',
      );
    await revokeRefreshToken(current.refresh_token);
    clearTokens();
  });
  resetStdioClientForTests();
  setDefaultFarm(null);
  console.error('Signed out.');
}
