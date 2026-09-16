import axios from 'axios';

import {
  initiateDeviceFlow,
  pollForToken,
  refreshAccessToken,
  revokeRefreshToken,
} from '../../../auth';
import { DEVICE_CODE_ENDPOINT, DEVICE_TOKEN_ENDPOINT, RANCHBOT_API_URL } from '../../../config';

jest.mock('axios');
jest.mock('../../../config', () => ({
  COGNITO_DEVICE_CLIENT_ID: 'test-client-id',
  DEVICE_CODE_ENDPOINT: 'https://test.auth.com/device',
  DEVICE_TOKEN_ENDPOINT: 'https://test.auth.com/token',
  RANCHBOT_API_URL: 'https://test.api.com',
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeviceFlow', () => {
    it('returns device code response when successful', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          device_code: 'device-code-123',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://test.com/verify',
          verification_uri_complete: 'https://test.com/verify?code=ABCD-EFGH',
          expires_in: 600,
          interval: 5,
        },
      } as any);

      const result = await initiateDeviceFlow();

      expect(mockedAxios.post).toHaveBeenCalledWith(DEVICE_CODE_ENDPOINT, {
        client_id: 'test-client-id',
        scope:
          'read:farms read:animals write:animals read:records write:records read:groups write:groups read:exports',
      });

      expect(result).toEqual({
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://test.com/verify',
        verification_uri_complete: 'https://test.com/verify?code=ABCD-EFGH',
        expires_in: 600,
        interval: 5,
      });
    });

    it('throws error when request fails', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'Invalid client' } },
        message: 'Request failed',
      });

      await expect(initiateDeviceFlow()).rejects.toThrow(
        'Failed to initiate device flow: Invalid client',
      );
    });
  });

  describe('pollForToken', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns tokens when authorization is approved', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read:farms',
        },
      } as any);

      const promise = pollForToken('device-code-123', 5);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(mockedAxios.post).toHaveBeenCalledWith(
        DEVICE_TOKEN_ENDPOINT,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: 'device-code-123',
          client_id: 'test-client-id',
        },
        {
          validateStatus: expect.any(Function),
        },
      );

      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read:farms',
      });
    });

    it('continues polling when authorization is pending', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 400,
          data: { error: 'authorization_pending' },
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        } as any);

      const promise = pollForToken('device-code-123', 5);
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result.access_token).toBe('access-token-123');
    });

    it('throws error when device code expires', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 400,
        data: { error: 'expired_token' },
      } as any);

      const promise = pollForToken('device-code-123', 5);
      // Process the promise immediately since it will fail on first attempt
      await expect(promise).rejects.toThrow(
        'Device code expired. Please restart the authorization flow.',
      );
    });

    it('throws error on timeout', async () => {
      jest.useRealTimers();

      // Mock all responses to return authorization_pending (will be called 60 times)
      mockedAxios.post.mockResolvedValue({
        status: 400,
        data: { error: 'authorization_pending' },
      } as any);

      // Use a very short interval (1ms) and reduce maxAttempts by patching
      // Since we can't easily modify maxAttempts, we'll use a short interval
      // and let it timeout naturally (but this will take 60ms which is acceptable)
      const promise = pollForToken('device-code-123', 0.001); // 1ms interval

      await expect(promise).rejects.toThrow('Authorization timeout. Please try again.');

      jest.useFakeTimers();
    }, 10000); // 10 seconds should be enough with 1ms intervals
  });

  describe('refreshAccessToken', () => {
    it('returns new tokens when refresh is successful', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token-123',
          refresh_token: 'new-refresh-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read:farms',
        },
      } as any);

      const result = await refreshAccessToken('refresh-token-123');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${RANCHBOT_API_URL}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: 'refresh-token-123',
        client_id: 'test-client-id',
      });

      expect(result).toEqual({
        access_token: 'new-access-token-123',
        refresh_token: 'new-refresh-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read:farms',
      });
    });

    it('uses existing refresh token when new one is not provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      } as any);

      const result = await refreshAccessToken('refresh-token-123');

      expect(result.refresh_token).toBe('refresh-token-123');
    });

    it('throws error when refresh fails', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'Invalid refresh token' } },
        message: 'Request failed',
      });

      await expect(refreshAccessToken('invalid-token')).rejects.toThrow(
        'Failed to refresh token: Invalid refresh token',
      );
    });
  });
});

describe('revokeRefreshToken', () => {
  it('posts the refresh token and configured client id to revocation', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 200 });
    await revokeRefreshToken('displaced-refresh');
    expect(mockedAxios.post).toHaveBeenCalledWith(`${RANCHBOT_API_URL}/oauth/revoke`, {
      token: 'displaced-refresh',
      client_id: 'test-client-id',
    });
  });

  it('propagates revocation errors', async () => {
    const failure = new Error('Revocation unavailable');
    mockedAxios.post.mockRejectedValueOnce(failure);
    await expect(revokeRefreshToken('displaced-refresh')).rejects.toBe(failure);
  });
});
