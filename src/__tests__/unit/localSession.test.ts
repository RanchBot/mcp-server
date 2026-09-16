import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import {
  clearLocalSession,
  loadLocalSession,
  localOrigin,
  localSessionPath,
  storeLocalSession,
} from '../../localSession';

jest.mock('os', () => ({ ...jest.requireActual('os'), homedir: jest.fn() }));

describe('installation-bound local sessions', () => {
  let directory: string;
  const origin = 'http://localhost:8080';
  const tokens = { access_token: 'rb_local_' + 'a'.repeat(43), expires_in: 3600 };
  beforeAll(() => {
    directory = mkdtempSync(join(os.tmpdir(), 'local-session-'));
  });
  beforeEach(() => jest.mocked(os.homedir).mockReturnValue(directory));
  afterAll(() => {
    jest.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });
  it('stores a private session readable by CLI and MCP only for its exact origin', () => {
    storeLocalSession(origin, tokens);
    expect(loadLocalSession(origin)?.access_token).toBe(tokens.access_token);
    expect(loadLocalSession('http://localhost:8081')).toBeNull();
    if (process.platform !== 'win32')
      expect(statSync(localSessionPath(origin)).mode & 0o777).toBe(0o600);
    const path = localSessionPath(origin);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...data, origin: 'https://different.example' }));
    expect(loadLocalSession(origin)).toBeNull();
    writeFileSync(path, JSON.stringify({ ...data, expires_at: 1 }));
    expect(loadLocalSession(origin)).toBeNull();
    clearLocalSession(origin);
    expect(loadLocalSession(origin)).toBeNull();
  });
  it('rejects insecure LAN addresses, URL credentials and non-origin paths', () => {
    for (const value of [
      'http://192.168.1.2:8080',
      'https://user:password@example.com',
      'https://example.com/api',
      'https://example.com/?token=bad',
    ])
      expect(() => localOrigin(value)).toThrow();
    expect(localOrigin('https://farm.example:8443')).toBe('https://farm.example:8443');
  });
});
