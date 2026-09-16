import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initiateDeviceFlow, OAuthTokens, pollForToken, revokeRefreshToken } from '../../auth';
import {
  getStdioClient,
  login as terminalLogin,
  resetStdioClientForTests,
} from '../../stdioClient';
import { loadTokens, storeTokens, StoredTokens, withTokenLock } from '../../tokenStorage';

jest.mock('../../auth');
jest.mock('../../tokenStorage', () => ({
  ...jest.requireActual('../../tokenStorage'),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
  withTokenLock: jest.fn(),
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const approved: OAuthTokens = {
  access_token: 'approved-access',
  refresh_token: 'approved-refresh',
  token_type: 'Bearer',
  expires_in: 900,
};
const rotated: StoredTokens = {
  access_token: 'rotated-access',
  refresh_token: 'rotated-refresh',
  expires_at: Date.now() + 900_000,
};
const realLock: typeof withTokenLock = jest.requireActual('../../tokenStorage').withTokenLock;

describe('device login replacement', () => {
  let directory: string;
  let lockFile: string;
  let cached: StoredTokens | null;
  let polling: ReturnType<typeof deferred<void>>;
  let approval: ReturnType<typeof deferred<OAuthTokens>>;
  let attemptedLock: ReturnType<typeof deferred<void>>;
  let events: string[];

  beforeEach(() => {
    resetStdioClientForTests();
    directory = mkdtempSync(join(tmpdir(), 'mcp-login-'));
    lockFile = join(directory, 'tokens.lock');
    cached = null;
    events = [];
    polling = deferred<void>();
    approval = deferred<OAuthTokens>();
    attemptedLock = deferred<void>();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(loadTokens).mockImplementation(() => cached);
    jest.mocked(storeTokens).mockImplementation((tokens) => {
      events.push('login:store');
      cached = { ...tokens, expires_at: Date.now() + tokens.expires_in * 1000 };
    });
    jest.mocked(initiateDeviceFlow).mockResolvedValue({
      device_code: 'device',
      user_code: 'code',
      verification_uri: 'https://example.com',
      verification_uri_complete: 'https://example.com/code',
      interval: 5,
      expires_in: 600,
    });
    jest.mocked(pollForToken).mockImplementation(() => {
      polling.resolve();
      return approval.promise;
    });
    jest.mocked(withTokenLock).mockImplementation((callback) => {
      attemptedLock.resolve();
      return realLock(callback, lockFile);
    });
    jest.mocked(revokeRefreshToken).mockImplementation(async () => {
      events.push('login:revoke');
    });
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    resetStdioClientForTests();
  });

  it('waits for competing refresh, reloads its rotated token, and revokes before replacement', async () => {
    const login = terminalLogin();
    await polling.promise;
    const refreshStarted = deferred<void>();
    const finishRefresh = deferred<void>();
    const refresh = realLock(async () => {
      cached = { ...rotated, refresh_token: 'before-rotation' };
      refreshStarted.resolve();
      await finishRefresh.promise;
      cached = rotated;
      events.push('refresh:store');
    }, lockFile);
    await refreshStarted.promise;
    attemptedLock = deferred<void>();
    approval.resolve(approved);
    await attemptedLock.promise;
    expect(storeTokens).not.toHaveBeenCalled();
    expect(revokeRefreshToken).not.toHaveBeenCalled();
    finishRefresh.resolve();
    await refresh;
    const client = await login;
    expect(revokeRefreshToken).toHaveBeenCalledWith('rotated-refresh');
    expect(events).toEqual(['refresh:store', 'login:revoke', 'login:store']);
    expect(cached?.refresh_token).toBe('approved-refresh');
    expect((client as any).accessToken).toBe('approved-access');
    expect(await getStdioClient()).toBe(client);
  });

  it('stores an approved session when the cache remains empty', async () => {
    const login = terminalLogin();
    await polling.promise;
    approval.resolve(approved);
    expect(((await login) as any).accessToken).toBe('approved-access');
    expect(withTokenLock).toHaveBeenCalledTimes(2);
    expect(revokeRefreshToken).not.toHaveBeenCalled();
    expect(storeTokens).toHaveBeenCalledWith(approved);
  });

  it.each(['revocation', 'storage'])(
    'does not authenticate when %s fails',
    async (failurePoint) => {
      const failure = new Error(`${failurePoint} unavailable`);
      const login = terminalLogin();
      const rejected = expect(login).rejects.toBe(failure);
      await polling.promise;
      cached = rotated;
      if (failurePoint === 'revocation') {
        jest.mocked(revokeRefreshToken).mockRejectedValueOnce(failure);
      } else {
        jest.mocked(storeTokens).mockImplementationOnce(() => {
          throw failure;
        });
      }
      approval.resolve(approved);
      await rejected;
      expect(cached).toBe(rotated);
      if (failurePoint === 'revocation') expect(storeTokens).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Authentication successful'),
      );
      expect(((await getStdioClient()) as any).accessToken).toBe('rotated-access');
    },
  );
});
