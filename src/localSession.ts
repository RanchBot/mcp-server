import { createHash, randomUUID } from 'crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Shared CLI/MCP local-session file contract. Credentials never enter tool arguments.
export interface LocalSessionCache {
  version: 1;
  origin: string;
  access_token: string;
  expires_at: number;
}
export function localOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Use the installation origin without credentials, path or query.');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error(
      'Local installations require HTTPS on the LAN; HTTP is allowed on loopback only.',
    );
  return url.origin;
}
export function localSessionPath(value: string): string {
  const origin = localOrigin(value);
  return join(
    homedir(),
    '.ranchbot',
    'local',
    createHash('sha256').update(origin).digest('hex') + '.json',
  );
}
export function loadLocalSession(value: string): LocalSessionCache | null {
  const origin = localOrigin(value);
  try {
    const data = JSON.parse(readFileSync(localSessionPath(origin), 'utf8')) as LocalSessionCache;
    if (
      data.version !== 1 ||
      data.origin !== origin ||
      !/^rb_local_[a-zA-Z0-9_-]{43}$/.test(data.access_token) ||
      !Number.isFinite(data.expires_at) ||
      data.expires_at <= Date.now()
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function storeLocalSession(
  value: string,
  tokens: { access_token: string; expires_in: number },
): void {
  const origin = localOrigin(value);
  if (
    !/^rb_local_[a-zA-Z0-9_-]{43}$/.test(tokens.access_token) ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0 ||
    tokens.expires_in > 7 * 86400
  )
    throw new Error('The installation returned an invalid local session.');
  const directory = join(homedir(), '.ranchbot', 'local');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const destination = localSessionPath(origin);
  const temporary = destination + '.' + randomUUID();
  try {
    writeFileSync(
      temporary,
      JSON.stringify({
        version: 1,
        origin,
        access_token: tokens.access_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      }),
      { flag: 'wx', mode: 0o600 },
    );
    renameSync(temporary, destination);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Already renamed. */
    }
  }
}
export function clearLocalSession(value: string): void {
  try {
    unlinkSync(localSessionPath(value));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
