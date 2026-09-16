describe('config', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('loads with zero environment variables set', async () => {
    delete process.env.RANCHBOT_API_URL;
    delete process.env.API_VERSION;
    delete process.env.COGNITO_DEVICE_CLIENT_ID;

    const configModule = await import('../../../config');

    expect(configModule.RANCHBOT_API_URL).toBe('https://api.ranch.bot');
    expect(configModule.API_VERSION).toBe('v1');
    expect(configModule.COGNITO_DEVICE_CLIENT_ID).toBe('ranchbot-mcp');
    expect(configModule.DEVICE_CODE_ENDPOINT).toBe('https://api.ranch.bot/oauth/device');
    expect(configModule.DEVICE_TOKEN_ENDPOINT).toBe('https://api.ranch.bot/oauth/device/token');
  });

  it('uses environment variables when they are set', async () => {
    process.env.RANCHBOT_API_URL = 'https://example.com';
    process.env.API_VERSION = 'v2';
    process.env.COGNITO_DEVICE_CLIENT_ID = 'test-device-client-id';

    const configModule = await import('../../../config');

    expect(configModule.RANCHBOT_API_URL).toBe('https://example.com');
    expect(configModule.API_VERSION).toBe('v2');
    expect(configModule.COGNITO_DEVICE_CLIENT_ID).toBe('test-device-client-id');
  });
});
