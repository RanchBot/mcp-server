import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let directory: string;
let storage: typeof import('../../tokenStorage');
let session: typeof import('../../stdioClient');
let auth: typeof import('../../auth');
let farms: typeof import('../../tools/list_my_farms');
const tokens = {
  access_token: 'access',
  refresh_token: 'rb_rt_refresh',
  token_type: 'Bearer',
  expires_in: 900,
};
const jwt = (sub: string, n = 1) =>
  `header.${Buffer.from(JSON.stringify({ sub, n })).toString('base64url')}.signature`;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-release-'));
  jest.doMock('os', () => ({ ...jest.requireActual('os'), homedir: () => directory }));
  jest.doMock('../../config', () => ({
    RANCHBOT_API_URL: 'https://api.example.com',
    COGNITO_DEVICE_CLIENT_ID: 'ranchbot-mcp',
  }));
  jest.doMock('../../auth', () => ({
    initiateDeviceFlow: jest.fn(),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  }));
  jest.isolateModules(() => {
    storage = require('../../tokenStorage');
    session = require('../../stdioClient');
    auth = require('../../auth');
    farms = require('../../tools/list_my_farms');
  });
});
afterEach(() => {
  jest.dontMock('os');
  jest.dontMock('../../config');
  jest.dontMock('../../auth');
  fs.rmSync(directory, { recursive: true, force: true });
});

it('returns terminal instructions without initiating device authorization', async () => {
  await expect(session.getStdioClient()).rejects.toThrow('ranchbot-mcp login');
  expect(auth.initiateDeviceFlow).not.toHaveBeenCalled();
});
it.each(['api_origin', 'client_id'])(
  'retains a mismatched %s cache through login and logout',
  async (field) => {
    storage.storeTokens(tokens);
    const file = path.join(directory, '.ranchbot-mcp-tokens.json');
    const cached = { ...storage.loadTokens(), [field]: 'other' };
    fs.writeFileSync(file, JSON.stringify(cached));
    await expect(session.login()).rejects.toThrow('another API origin or client');
    await expect(session.logout()).rejects.toThrow('another API origin or client');
    expect(() => storage.storeTokens(tokens)).toThrow('another API origin or client');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(cached);
    expect(auth.revokeRefreshToken).not.toHaveBeenCalled();
  },
);
it('retains credentials when revocation fails', async () => {
  storage.storeTokens(tokens);
  jest.mocked(auth.revokeRefreshToken).mockRejectedValueOnce(new Error('unavailable'));
  await expect(session.logout()).rejects.toThrow('unavailable');
  expect(storage.loadTokens()?.refresh_token).toBe('rb_rt_refresh');
  await session.logout();
  expect(storage.loadTokens()).toBeNull();
});
it('requires original settings for legacy logout and never uses legacy credentials for tools', async () => {
  fs.writeFileSync(
    path.join(directory, '.ranchbot-mcp-tokens.json'),
    JSON.stringify({
      ...tokens,
      access_token: `header.${Buffer.from(JSON.stringify({ client_id: 'ranchbot-mcp' })).toString('base64url')}.signature`,
    }),
  );
  const oldApi = process.env.RANCHBOT_API_URL;
  const oldClient = process.env.COGNITO_DEVICE_CLIENT_ID;
  try {
    delete process.env.RANCHBOT_API_URL;
    delete process.env.COGNITO_DEVICE_CLIENT_ID;
    await expect(session.logout()).rejects.toThrow('Legacy cache');
    process.env.RANCHBOT_API_URL = 'https://api.example.com';
    process.env.COGNITO_DEVICE_CLIENT_ID = 'ranchbot-mcp';
    await expect(session.getStdioClient()).rejects.toThrow('Legacy cache');
    await session.logout();
    expect(auth.revokeRefreshToken).toHaveBeenCalledWith('rb_rt_refresh');
  } finally {
    if (oldApi === undefined) delete process.env.RANCHBOT_API_URL;
    else process.env.RANCHBOT_API_URL = oldApi;
    if (oldClient === undefined) delete process.env.COGNITO_DEVICE_CLIENT_ID;
    else process.env.COGNITO_DEVICE_CLIENT_ID = oldClient;
  }
});
it('tightens existing cache permissions on load', () => {
  storage.storeTokens(tokens);
  const file = path.join(directory, '.ranchbot-mcp-tokens.json');
  fs.chmodSync(file, 0o644);
  storage.loadTokens();
  if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});
it('retains farm selection on refresh but clears it when the principal changes', async () => {
  storage.storeTokens({ ...tokens, access_token: jwt('first') });
  await session.getStdioClient();
  farms.setDefaultFarm('farm-first');
  storage.storeTokens({ ...tokens, access_token: jwt('first', 2) });
  await session.getStdioClient();
  expect(farms.getDefaultFarm()).toBe('farm-first');
  storage.storeTokens({ ...tokens, access_token: jwt('second') });
  await session.getStdioClient();
  expect(farms.getDefaultFarm()).toBeNull();
});

it('does not treat a legacy provider revocation no-op as logout', async () => {
  const file = path.join(directory, '.ranchbot-mcp-tokens.json');
  fs.writeFileSync(file, JSON.stringify({ ...tokens, refresh_token: 'provider-refresh' }));
  const oldApi = process.env.RANCHBOT_API_URL;
  const oldClient = process.env.COGNITO_DEVICE_CLIENT_ID;
  try {
    process.env.RANCHBOT_API_URL = 'https://api.example.com';
    process.env.COGNITO_DEVICE_CLIENT_ID = 'ranchbot-mcp';
    await expect(session.logout()).rejects.toThrow('cannot be revoked');
    expect(auth.revokeRefreshToken).not.toHaveBeenCalled();
    expect(fs.existsSync(file)).toBe(true);
  } finally {
    if (oldApi === undefined) delete process.env.RANCHBOT_API_URL;
    else process.env.RANCHBOT_API_URL = oldApi;
    if (oldClient === undefined) delete process.env.COGNITO_DEVICE_CLIENT_ID;
    else process.env.COGNITO_DEVICE_CLIENT_ID = oldClient;
  }
});

it('retains a malformed cache without echoing credential contents', async () => {
  const file = path.join(directory, '.ranchbot-mcp-tokens.json');
  fs.writeFileSync(file, '{"access_token":"fixture-private-value"');
  await expect(session.logout()).rejects.toThrow('Cannot read the token cache');
  expect(auth.revokeRefreshToken).not.toHaveBeenCalled();
  expect(fs.existsSync(file)).toBe(true);
});
