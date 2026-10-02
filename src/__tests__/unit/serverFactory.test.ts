import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRanchBotServer, ServerDeps } from '../../serverFactory';
import { SERVER_INSTRUCTIONS } from '../../serverInstructions';
import { RanchBotApiClient } from '../../client';
import { createMockClient } from './testUtils';
import { PACKAGE_VERSION } from '../../version';

// Locked tool surface: a rename or removal is a breaking change for every MCP client.
const EXPECTED_TOOL_NAMES = [
  'add_identifier',
  'confirm_birth_event',
  'create_animal',
  'create_chute_session',
  'create_group',
  'create_protocol_version',
  'create_ration',
  'create_record',
  'delete_animal',
  'delete_group',
  'delete_record',
  'farm_archive',
  'find_animal_by_identifier',
  'find_or_create_animal_by_eid',
  'get_animal',
  'get_birth_event',
  'get_birth_history_evidence',
  'get_birth_history_settings',
  'get_birth_source_evidence',
  'get_chute_session',
  'get_current_context',
  'get_farm',
  'get_feeding',
  'get_group',
  'get_import_request',
  'get_ration',
  'get_record',
  'list_animals',
  'list_birth_events',
  'list_chute_sessions',
  'list_farm_tasks',
  'list_feedings',
  'list_groups',
  'list_identifiers',
  'list_memories',
  'list_my_farms',
  'list_pending_imports',
  'list_protocol_versions',
  'list_rations',
  'list_records',
  'lookup_animal_by_eid',
  'preview_birth_event',
  'remove_identifier',
  'restore_group',
  'set_birth_history_settings',
  'set_default_farm',
  'update_animal',
  'update_chute_session',
  'update_farm_task',
  'update_group',
  'update_import_request_status',
  'update_record',
];

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

  it('passes an explicit farm_id through without resolving the default', async () => {
    const mockClient = createMockClient();
    mockClient.listAnimals.mockResolvedValue({ records: [], total: 0 } as any);
    const resolveDefaultFarm = jest.fn().mockResolvedValue('default-farm');
    const deps = depsWith({
      getClient: jest.fn().mockResolvedValue(mockClient),
      resolveDefaultFarm,
    });
    const { client } = await connect(deps)();
    await client.callTool({ name: 'list_animals', arguments: { farm_id: 'explicit-farm' } });
    expect(mockClient.listAnimals).toHaveBeenCalledWith('explicit-farm', {});
    expect(resolveDefaultFarm).not.toHaveBeenCalled();
    await client.close();
  });

  it('publishes server instructions and does not authenticate for discovery', async () => {
    const deps = depsWith();
    const { client } = await connect(deps)();
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    expect(client.getInstructions()).toMatch(/farm_id/);
    expect(client.getInstructions()).toMatch(/approval/i);
    const result = await client.listTools();
    expect(result.tools.length).toBe(EXPECTED_TOOL_NAMES.length);
    expect(deps.getClient).not.toHaveBeenCalled();
    await client.close();
  });

  it('exposes the saved-birth correction boundary on the always-on MCP surface', async () => {
    const deps = depsWith();
    const { client } = await connect(deps)();

    const instructions = client.getInstructions() ?? '';
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t] as const));
    const preview = byName.get('preview_birth_event')!;
    const confirm = byName.get('confirm_birth_event')!;

    // Each surface must stand alone: an MCP-only client sees the initialization instructions
    // and tool descriptions, but never the optional Agent Skill.
    for (const surface of [instructions, preview.description ?? '', confirm.description ?? '']) {
      expect(surface).toMatch(/saved birth cannot be corrected/i);
      expect(surface).toContain('https://ranch.bot/support');
      expect(surface).toMatch(/without promising an amendment/i);
      expect(surface).toMatch(/re-record/i);
      expect(surface).toMatch(/new request_id/i);
      expect(surface).toMatch(/provenance/i);
      expect(surface).toMatch(/generic animal, record, or task edits/i);
    }

    // Preview: changes are limited to unconfirmed proposals and keep exact approval.
    expect(preview.description).toMatch(/Before confirmation only/i);
    expect(preview.description).toMatch(/another preview and renewed approval/i);
    expect(preview.description).toMatch(/explicit approval of this exact preview/i);

    // Confirmation: retains the approved tuple and separates retries from corrections.
    expect(confirm.description).toMatch(/request_id, bundle, and confirmation_hash exactly/i);
    expect(confirm.description).toMatch(/unchanged retry of the exact approved tuple/i);
    expect(confirm.description).toMatch(/retrieval, not a correction/i);
    expect(confirm.description).toMatch(/reconcile with reads before any further write/i);

    await client.close();
  });

  it('keeps the tool names and schemas stable', async () => {
    const deps = depsWith();
    const { client } = await connect(deps)();
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOL_NAMES);
    const listAnimals = tools.find((t) => t.name === 'list_animals')!;
    expect(Object.keys(listAnimals.inputSchema.properties ?? {}).sort()).toEqual([
      'farm_id',
      'inventory_status',
      'skip',
      'take',
    ]);
    const preview = tools.find((t) => t.name === 'preview_birth_event')!;
    expect(preview.inputSchema.required).toEqual(['request_id', 'bundle']);
    await client.close();
  });

  it('annotates dangerous and context-changing tools accurately', async () => {
    const deps = depsWith();
    const { client } = await connect(deps)();
    const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t] as const));

    // Every tool carries at least a read-only hint; conservative defaults are acceptable.
    for (const tool of byName.values()) {
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations?.readOnlyHint).toBe('boolean');
    }

    // Find-or-create must not read as a read-only lookup or promise idempotency.
    const findOrCreate = byName.get('find_animal_by_identifier')!;
    expect(findOrCreate.annotations?.readOnlyHint).toBe(false);
    expect(findOrCreate.annotations?.idempotentHint).not.toBe(true);
    expect(findOrCreate.description).toMatch(/find or create/i);

    // Archive mixes reads with job writes and a local download.
    const archive = byName.get('farm_archive')!;
    expect(archive.annotations?.readOnlyHint).toBe(false);
    expect(archive.annotations?.destructiveHint).toBe(false);
    expect(archive.description).toMatch(/create/i);

    // Context change, not farm data.
    const setDefault = byName.get('set_default_farm')!;
    expect(setDefault.annotations?.readOnlyHint).toBe(false);
    expect(setDefault.description).toMatch(/changes context/i);

    // Genuine reads stay marked read-only.
    for (const name of [
      'list_my_farms',
      'get_farm',
      'get_current_context',
      'list_pending_imports',
      'get_import_request',
      'lookup_animal_by_eid',
      'preview_birth_event',
    ]) {
      expect(byName.get(name)?.annotations?.readOnlyHint).toBe(true);
    }
    expect(byName.get('remove_identifier')?.annotations?.destructiveHint).toBe(true);
    expect(byName.get('confirm_birth_event')?.annotations?.readOnlyHint).toBe(false);
    await client.close();
  });

  it('reports the package version in the MCP handshake', async () => {
    const { client } = await connect(depsWith())();
    expect(client.getServerVersion()?.version).toBe(PACKAGE_VERSION);
    await client.close();
  });
});
