import { tryLock } from 'fs-native-extensions';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { OAuthTokens } from './auth';
import { ADMIN_MODE, RANCHBOT_API_URL, COGNITO_DEVICE_CLIENT_ID } from './config';

const TOKEN_BASENAME = ADMIN_MODE ? '.ranchbot-mcp-admin-tokens' : '.ranchbot-mcp-tokens';
const TOKEN_FILE = path.join(homedir(), `${TOKEN_BASENAME}.json`);
const TOKEN_LOCK_FILE = path.join(homedir(), `${TOKEN_BASENAME}.lock`);

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  api_origin?: string;
  client_id?: string;
}

/**
 * Store OAuth tokens securely
 */
export const storeTokens = (tokens: OAuthTokens): void => {
  try {
    loadTokens(); // Reject incompatible caches before replacing them.
    const stored: StoredTokens = {
      api_origin: new URL(RANCHBOT_API_URL).origin,
      client_id: COGNITO_DEVICE_CLIENT_ID,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    };
    if (fs.existsSync(TOKEN_FILE)) fs.chmodSync(TOKEN_FILE, 0o600);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(stored, null, 2), {
      mode: 0o600,
    });
  } catch (error: any) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
};

/**
 * Load stored OAuth tokens
 */
export const loadTokens = (allowLegacyLogout = false): StoredTokens | null => {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  fs.chmodSync(TOKEN_FILE, 0o600);
  let tokens: StoredTokens;
  try {
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    throw new Error(
      'Cannot read the token cache. Credentials were retained; restore the cache before retrying.',
    );
  }
  if (Boolean(tokens.api_origin) !== Boolean(tokens.client_id)) {
    throw new Error(
      'Incomplete cache binding. Credentials were retained; restore the original cache settings before logout.',
    );
  }
  if (!tokens.api_origin || !tokens.client_id) {
    if (allowLegacyLogout && process.env.RANCHBOT_API_URL && process.env.COGNITO_DEVICE_CLIENT_ID) {
      if (!tokens.refresh_token?.startsWith('rb_rt_')) {
        throw new Error(
          'Legacy provider credentials cannot be revoked by this device-session endpoint. Revoke access with the original provider before removing this cache; credentials were retained.',
        );
      }
      let originalClient: unknown;
      try {
        originalClient = JSON.parse(
          Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString(),
        ).client_id;
      } catch {
        /* Legacy credentials must identify their original device client. */
      }
      if (originalClient !== COGNITO_DEVICE_CLIENT_ID) {
        throw new Error(
          'Legacy cache client cannot be confirmed. Use its original COGNITO_DEVICE_CLIENT_ID; credentials were retained.',
        );
      }
      return tokens;
    }
    throw new Error(
      'Legacy cache: stop older clients, then run ranchbot-mcp logout with the original RANCHBOT_API_URL and COGNITO_DEVICE_CLIENT_ID. Credentials were retained.',
    );
  }
  if (
    tokens.api_origin !== new URL(RANCHBOT_API_URL).origin ||
    tokens.client_id !== COGNITO_DEVICE_CLIENT_ID
  ) {
    throw new Error(
      'Token cache belongs to another API origin or client. Use its original settings to log out first. Credentials were retained.',
    );
  }
  return tokens;
};

/**
 * Check if tokens are expired
 */
export const isTokenExpired = (tokens: StoredTokens | null): boolean => {
  if (!tokens) return true;
  return Date.now() >= tokens.expires_at;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

/** Serialize refresh-token rotation across MCP server processes. */
export const withTokenLock = async <T>(
  callback: () => Promise<T>,
  lockFile = TOKEN_LOCK_FILE,
): Promise<T> => {
  const deadline = Date.now() + 30_000;
  // The inode must persist: unlinking it would let contenders lock different files.
  const lock = fs.openSync(lockFile, fs.constants.O_RDWR | fs.constants.O_CREAT, 0o600);
  try {
    fs.fchmodSync(lock, 0o600);
    while (!tryLock(lock)) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the token cache lock');
      await wait(25);
    }

    // Older clients used PID files. They must be stopped before upgrading.
    const owner = fs.readFileSync(lock, 'utf8');
    const pid = Number(owner.split(':', 1)[0]);
    if (Number.isSafeInteger(pid) && pid > 0 && isProcessRunning(pid)) {
      throw new Error(
        'Legacy token cache lock has a live owner; stop older clients before upgrading',
      );
    }
    // Retire legacy PID metadata in place without truncating the locked file.
    if (!owner.startsWith('native-lock')) fs.writeSync(lock, 'native-lock', 0, 'utf8');
    return await callback();
  } finally {
    // Closing also releases ownership after errors; the OS releases it on process death.
    fs.closeSync(lock);
  }
};

/**
 * Clear stored tokens
 */
export const clearTokens = (): void => {
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
};
