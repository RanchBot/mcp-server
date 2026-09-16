import axios from 'axios';

import { initiateDeviceFlow, refreshAccessToken, revokeRefreshToken } from '../../../auth';

jest.mock('axios');
jest.mock('../../../config', () => ({
  COGNITO_DEVICE_CLIENT_ID: '',
  DEVICE_CODE_ENDPOINT: 'https://test.auth.com/device',
  DEVICE_TOKEN_ENDPOINT: 'https://test.auth.com/token',
  RANCHBOT_API_URL: 'https://test.api.com',
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('auth without a configured client id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fail device flow with a clear message when no client id is configured', async () => {
    await expect(initiateDeviceFlow()).rejects.toThrow('No OAuth client id configured');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should fail token refresh with a clear message when no client id is configured', async () => {
    await expect(refreshAccessToken('some-refresh-token')).rejects.toThrow(
      'No OAuth client id configured',
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});

it('rejects revocation without a configured client id before sending a request', async () => {
  await expect(revokeRefreshToken('refresh')).rejects.toThrow('No OAuth client id configured');
  expect(mockedAxios.post).not.toHaveBeenCalled();
});
