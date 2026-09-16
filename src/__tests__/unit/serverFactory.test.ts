import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRanchBotServer, ServerDeps } from '../../serverFactory';
import { RanchBotApiClient } from '../../client';
import { createMockClient } from './testUtils';

/**
 * Wire the factory-built server to an in-memory MCP client so the glue logic
 * (farm-resolution, the farm-required gate, exemption, set_default_farm persist)
 * is exercised end-to-end. The individual tool handlers are covered by their own
 * suites; here we inject mocked ServerDeps + a mock API client.
 */
const connect = (deps: ServerDeps) => async () => {
  const server = createRanchBotServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return { client, server };
};

const depsWith = (
  overrides: Partial<ServerDeps> = {},
): ServerDeps & {
  mockClient: jest.Mocked<RanchBotApiClient>;
} => {
  const mockClient = createMockClient();
  return {
    getClient: jest.fn().mockResolvedValue(mockClient),
    resolveDefaultFarm: jest.fn().mockResolvedValue(null),
    persistDefaultFarm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
    mockClient,
  } as ServerDeps & { mockClient: jest.Mocked<RanchBotApiClient> };
};

describe('createRanchBotServer', () => {
  it('lists the registered tools', async () => {
    const deps = depsWith();
    const { client } = await connect(deps)();
    const result = await client.listTools();
    expect(result.tools.length).toBeGreaterThan(10);
    expect(result.tools.map((t) => t.name)).toContain('list_animals');
    await client.close();
  });

  it('requires a farm for a farm-scoped tool when no default is set', async () => {
    const deps = depsWith({ resolveDefaultFarm: jest.fn().mockResolvedValue(null) });
    const { client } = await connect(deps)();
    await expect(client.callTool({ name: 'list_animals', arguments: {} })).rejects.toThrow(
      /Farm ID is required/,
    );
    expect(deps.resolveDefaultFarm).toHaveBeenCalled();
    await client.close();
  });

  it('runs an exempt tool without a farm', async () => {
    const mockClient = createMockClient();
    mockClient.getFarms.mockResolvedValue({
      farms: [{ id: 'f1', name: 'Home Farm' }],
      total: 1,
    });
    const deps = depsWith({ getClient: jest.fn().mockResolvedValue(mockClient) });
    const { client } = await connect(deps)();
    const result = await client.callTool({ name: 'list_my_farms', arguments: {} });
    expect((result as any).content?.[0]?.type).toBe('text');
    await client.close();
  });

  it('persists the default farm when set_default_farm is called', async () => {
    const persist = jest.fn().mockResolvedValue(undefined);
    const deps = depsWith({
      resolveDefaultFarm: jest.fn().mockResolvedValue('existing-farm'),
      persistDefaultFarm: persist,
    });
    const { client } = await connect(deps)();
    await client.callTool({ name: 'set_default_farm', arguments: { farm_id: 'farm-42' } });
    expect(persist).toHaveBeenCalledWith(expect.anything(), 'farm-42');
    await client.close();
  });
});
