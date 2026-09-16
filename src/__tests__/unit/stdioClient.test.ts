import { refreshAccessToken } from '../../auth';
import { getStdioClient, resetStdioClientForTests } from '../../stdioClient';
import {
  clearTokens,
  isTokenExpired,
  loadTokens,
  storeTokens,
  withTokenLock,
} from '../../tokenStorage';

jest.mock('../../auth', () => ({
  initiateDeviceFlow: jest.fn(),
  pollForToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../tokenStorage', () => ({
  clearTokens: jest.fn(),
  isTokenExpired: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
  withTokenLock: jest.fn(),
}));

const mockedClearTokens = clearTokens as jest.MockedFunction<typeof clearTokens>;
const mockedLoadTokens = loadTokens as jest.MockedFunction<typeof loadTokens>;
const mockedIsTokenExpired = isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;
const mockedRefresh = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;
const mockedWithTokenLock = withTokenLock as jest.MockedFunction<typeof withTokenLock>;

const expiredTokens = {
  access_token: 'old-access',
  refresh_token: 'old-refresh',
  expires_at: 1,
};

describe('getStdioClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStdioClientForTests();
    mockedLoadTokens.mockReturnValue(expiredTokens);
    mockedIsTokenExpired.mockReturnValue(true);
    mockedRefresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      token_type: 'Bearer',
      expires_in: 900,
    });
    mockedWithTokenLock.mockImplementation((callback) => callback());
  });

  it('single-flights parallel refreshes into one usable session', async () => {
    const [first, second] = await Promise.all([getStdioClient(), getStdioClient()]);

    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(mockedRefresh).toHaveBeenCalledWith('old-refresh');
    expect(storeTokens).toHaveBeenCalledTimes(1);
    expect((first as any).accessToken).toBe('new-access');
    expect(second).toBe(first);
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('reuses a session another process rotated before the lock was acquired', async () => {
    const rotated = {
      access_token: 'other-process-access',
      refresh_token: 'other-process-refresh',
      expires_at: Date.now() + 900_000,
    };
    mockedWithTokenLock.mockImplementationOnce((callback) => {
      mockedLoadTokens.mockReturnValue(rotated);
      return callback();
    });
    mockedIsTokenExpired.mockImplementation((tokens) => tokens?.access_token === 'old-access');

    const client = await getStdioClient();

    expect(mockedWithTokenLock).toHaveBeenCalledTimes(1);
    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(storeTokens).not.toHaveBeenCalled();
    expect((client as any).accessToken).toBe('other-process-access');
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves a later winner when the cache changes before cleanup: %s',
    async (replaceBeforeFailure) => {
      const events: string[] = [];
      let cached: typeof expiredTokens | null = expiredTokens;
      const winnerTokens = {
        access_token: 'winner-access',
        refresh_token: 'winner-refresh',
        expires_at: Date.now() + 900_000,
      };
      let rejectRefresh!: (error: Error) => void;
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      mockedLoadTokens.mockImplementation(() => cached);
      mockedIsTokenExpired.mockImplementation((tokens) => !tokens || tokens.expires_at === 1);
      mockedClearTokens.mockImplementation(() => {
        cached = null;
        events.push('clear');
      });
      mockedRefresh.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectRefresh = reject;
            markStarted();
          }),
      );
      mockedWithTokenLock.mockImplementationOnce(async (callback) => {
        try {
          return await callback();
        } finally {
          events.push('unlock');
          // A queued writer may store its session as soon as the lock is released.
          if (!replaceBeforeFailure) {
            expect(cached).toBeNull();
            cached = winnerTokens;
            events.push('winner:store');
          }
        }
      });

      const failed = expect(getStdioClient()).rejects.toThrow(/Authentication required/);
      await started;
      if (replaceBeforeFailure) {
        cached = winnerTokens;
        events.push('winner:store');
      }
      rejectRefresh(new Error('temporary failure'));
      await failed;

      expect(events).toEqual(
        replaceBeforeFailure ? ['winner:store', 'unlock'] : ['clear', 'unlock', 'winner:store'],
      );
      expect(mockedClearTokens).toHaveBeenCalledTimes(replaceBeforeFailure ? 0 : 1);
      expect(cached).toEqual(winnerTokens);
      const winner = await getStdioClient();
      expect((winner as any).accessToken).toBe('winner-access');
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    },
  );
});
