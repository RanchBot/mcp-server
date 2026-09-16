import axios from 'axios';
import type * as Auth from '../../../auth';

jest.mock('axios');
jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockedAxios = jest.mocked(axios);
const farmScopes =
  'read:farms read:animals write:animals read:records write:records read:groups write:groups read:exports';

it.each([
  { mode: 'ordinary', args: [], configuredClient: 'farm-client', expectedClient: 'farm-client' },
  {
    mode: '--admin',
    args: ['--admin'],
    configuredClient: 'farm-client',
    expectedClient: 'ranchbot-admin-cli',
  },
  {
    mode: 'explicit admin client',
    args: [],
    configuredClient: 'ranchbot-admin-cli',
    expectedClient: 'ranchbot-admin-cli',
  },
])(
  'uses consistent client identity and scopes for $mode sign-in',
  async ({ args, configuredClient, expectedClient }) => {
    jest.replaceProperty(process, 'argv', [process.execPath, 'ranchbot-mcp', ...args]);
    jest.replaceProperty(process, 'env', {
      RANCHBOT_API_URL: 'https://example.test',
      COGNITO_DEVICE_CLIENT_ID: configuredClient,
    });
    let auth!: typeof Auth;
    jest.isolateModules(() => {
      auth = require('../../../auth');
    });

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 900 },
    });
    await auth.initiateDeviceFlow();
    await auth.pollForToken('test-device');
    await auth.refreshAccessToken('test-refresh');
    await auth.revokeRefreshToken('test-refresh');

    expect(mockedAxios.post.mock.calls[0][1]).toEqual({
      client_id: expectedClient,
      scope: farmScopes + (expectedClient === 'ranchbot-admin-cli' ? ' admin:imports' : ''),
    });
    expect(mockedAxios.post.mock.calls).toHaveLength(4);
    for (const [, body] of mockedAxios.post.mock.calls) {
      expect(body).toHaveProperty('client_id', expectedClient);
    }
  },
);
