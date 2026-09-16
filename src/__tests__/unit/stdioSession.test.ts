import { mkdtempSync, rmSync } from 'fs';
import { createServer, Server, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import type { OAuthTokens } from '../../auth';
import type * as StdioClient from '../../stdioClient';
import type * as TokenStorage from '../../tokenStorage';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const tokensFor = (session: string): OAuthTokens => ({
  access_token: `${session}-access`,
  refresh_token: `${session}-refresh`,
  token_type: 'Bearer',
  expires_in: 900,
});

const respond = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

describe('running stdio clients sharing a token cache', () => {
  let directory: string;
  let server: Server;
  let first: typeof StdioClient;
  let second: typeof StdioClient;
  let storage: typeof TokenStorage;
  let approvals: ReturnType<typeof deferred<ServerResponse>>[];
  let activeTokens: Set<string>;
  let revoked: string[];
  let requests: { method: string; token: string }[];
  let rejectMutation: boolean;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'mcp-stdio-session-'));
    approvals = [deferred<ServerResponse>(), deferred<ServerResponse>()];
    activeTokens = new Set();
    revoked = [];
    requests = [];
    rejectMutation = false;
    let nextDevice = 0;
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      if (request.url === '/oauth/device') {
        const device = nextDevice++;
        respond(response, 200, {
          device_code: String(device),
          user_code: `code-${device}`,
          verification_uri: 'https://example.com/activate',
          verification_uri_complete: `https://example.com/activate?code=${device}`,
          expires_in: 600,
          interval: 1,
        });
      } else if (request.url === '/oauth/device/token') {
        // Hold both device flows at a deterministic approval barrier.
        approvals[Number(body.device_code)].resolve(response);
      } else if (request.url === '/oauth/revoke') {
        revoked.push(body.token);
        activeTokens.delete(body.token.replace('-refresh', '-access'));
        respond(response, 200, {});
      } else if (request.url?.startsWith('/api/v1/farm')) {
        const token = (request.headers.authorization || '').replace('Bearer ', '');
        requests.push({ method: request.method!, token });
        if (!activeTokens.has(token) || (rejectMutation && request.method === 'POST')) {
          respond(response, 401, { message: 'Session revoked' });
        } else if (request.method === 'POST') {
          respond(response, 201, { id: 'animal-1' });
        } else {
          respond(response, 200, { records: [{ id: 'farm-1' }], total: 1 });
        }
      } else {
        respond(response, 404, { message: 'Unexpected fixture request' });
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing fixture port');
    const baseURL = `http://127.0.0.1:${address.port}`;
    jest.doMock('../../config', () => ({
      RANCHBOT_API_URL: baseURL,
      API_VERSION: 'v1',
      COGNITO_DEVICE_CLIENT_ID: 'test-device-client',
      DEVICE_CODE_ENDPOINT: `${baseURL}/oauth/device`,
      DEVICE_TOKEN_ENDPOINT: `${baseURL}/oauth/device/token`,
    }));
    jest.doMock('os', () => ({ ...jest.requireActual('os'), homedir: () => directory }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Only environment boundaries are mocked; auth, HTTP, storage and locks are real.
    jest.isolateModules(() => {
      first = require('../../stdioClient');
      storage = require('../../tokenStorage');
    });
    jest.isolateModules(() => {
      second = require('../../stdioClient');
    });
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    jest.dontMock('../../config');
    jest.dontMock('os');
    rmSync(directory, { recursive: true, force: true });
  });

  it('keeps the first client usable after a second overlapping login replaces its session', async () => {
    const firstCall = first.login().then((client) => client.getFarms());
    const firstApproval = await approvals[0].promise;
    const secondCall = second.login().then((client) => client.getFarms());
    const secondApproval = await approvals[1].promise;

    activeTokens.add('first-access');
    respond(firstApproval, 200, tokensFor('first'));
    await expect(firstCall).resolves.toEqual({ farms: [{ id: 'farm-1' }], total: 1 });

    activeTokens.add('second-access');
    respond(secondApproval, 200, tokensFor('second'));
    await secondCall;
    expect(revoked).toEqual(['first-refresh']);
    expect(storage.loadTokens()?.access_token).toBe('second-access');

    await expect(first.getStdioClient().then((client) => client.getFarms())).resolves.toEqual({
      farms: [{ id: 'farm-1' }],
      total: 1,
    });
    await expect(
      first.getStdioClient().then((client) => client.createAnimal('farm-1', {})),
    ).resolves.toEqual({ id: 'animal-1' });
    expect(requests).toEqual([
      { method: 'GET', token: 'first-access' },
      { method: 'GET', token: 'second-access' },
      { method: 'GET', token: 'second-access' },
      { method: 'POST', token: 'second-access' },
    ]);
  });

  it('surfaces an authentication failure without replaying a mutation', async () => {
    storage.storeTokens(tokensFor('first'));
    activeTokens.add('first-access');
    const client = await first.getStdioClient();
    await storage.withTokenLock(async () => {
      storage.storeTokens(tokensFor('second'));
      activeTokens.delete('first-access');
      activeTokens.add('second-access');
    });

    // This request already selected its client when the other process replaced the cache.
    await expect(client.createAnimal('farm-1', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(requests).toEqual([{ method: 'POST', token: 'first-access' }]);

    rejectMutation = true;
    await expect(
      first.getStdioClient().then((current) => current.createAnimal('farm-1', {})),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(requests).toEqual([
      { method: 'POST', token: 'first-access' },
      { method: 'POST', token: 'second-access' },
    ]);
  });

  it('waits for a replacement to finish before selecting credentials for another call', async () => {
    storage.storeTokens(tokensFor('first'));
    activeTokens.add('first-access');
    await first.getStdioClient();
    const replacing = deferred<void>();
    const finishReplacement = deferred<void>();
    const replacement = storage.withTokenLock(async () => {
      activeTokens.delete('first-access');
      storage.clearTokens();
      replacing.resolve();
      await finishReplacement.promise;
      storage.storeTokens(tokensFor('second'));
      activeTokens.add('second-access');
    });
    await replacing.promise;

    const read = first.getStdioClient().then((client) => client.getFarms());
    finishReplacement.resolve();
    await replacement;

    await expect(read).resolves.toEqual({ farms: [{ id: 'farm-1' }], total: 1 });
    expect(requests).toEqual([{ method: 'GET', token: 'second-access' }]);
  });
});
