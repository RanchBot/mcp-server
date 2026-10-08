import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RanchBotApiClient } from '../../client';
import { createRanchBotServer } from '../../serverFactory';
import { registerTools } from '../../tools';
import { paginatedToolSchemas } from '../../tools/_shared/listSchemas';
import { templateDefinitionSchema } from '../../tools/_shared/workflowSchemas';
import { toInputSchema } from '../../tools/_shared/inputSchemas';
import { toolInputSchemas } from '../../tools/_shared/toolInputSchemas';
import { templateDefinition, templateDefinitionCases } from '../fixtures/templateDefinitions';

const farmId = '11111111-1111-4111-8111-111111111111';
const templateId = '22222222-2222-4222-8222-222222222222';
const apiMethods = {
  list_animals: 'listAnimals',
  list_records: 'listRecords',
  list_feedings: 'listFeedings',
  list_rations: 'listRations',
  list_chute_sessions: 'listChuteSessions',
  list_pending_imports: 'listImportRequests',
  list_birth_events: 'listBirthEvents',
  list_farm_tasks: 'listFarmTasks',
  list_protocol_versions: 'listProtocolVersions',
  list_workflow_templates: 'listWorkflowTemplates',
} as const;
const invalidPages = [
  { skip: -1 },
  { skip: 0.5 },
  { skip: '1' },
  { skip: null },
  { skip: true },
  { take: 0 },
  { take: -1 },
  { take: 1.5 },
  { take: 201 },
  { take: '10' },
  { take: null },
  { take: false },
];
const ajv = addFormats(new Ajv({ strict: false }));
const tools = new Map(registerTools().map((tool) => [tool.name, tool]));

const connect = async () => {
  const api = Object.fromEntries(
    [...Object.values(apiMethods), 'createWorkflowTemplate', 'publishWorkflowTemplateVersion'].map(
      (name) => [name, jest.fn().mockResolvedValue({ records: [], total: 0 })],
    ),
  );
  const deps = {
    getClient: jest.fn().mockResolvedValue(api as unknown as RanchBotApiClient),
    resolveDefaultFarm: jest.fn().mockResolvedValue(farmId),
    persistDefaultFarm: jest.fn(),
  };
  const server = createRanchBotServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'validation-test', version: '1.0' });
  await client.connect(clientTransport);
  return { client, api, deps };
};

const expectNoEffects = (
  api: Record<string, jest.Mock>,
  deps: Awaited<ReturnType<typeof connect>>['deps'],
) => {
  for (const method of Object.values(api)) expect(method).not.toHaveBeenCalled();
  expect(deps.getClient).not.toHaveBeenCalled();
  expect(deps.resolveDefaultFarm).not.toHaveBeenCalled();
  expect(deps.persistDefaultFarm).not.toHaveBeenCalled();
};

describe('shared MCP input schemas', () => {
  it.each(Object.entries(toolInputSchemas))(
    'advertises the runtime schema for %s',
    (name, schema) => {
      expect(tools.get(name)?.inputSchema).toEqual(toInputSchema(schema));
    },
  );
});

describe('pagination MCP boundary', () => {
  it('covers every advertised paginated tool', () => {
    expect(
      [...tools.values()]
        .filter((tool) => tool.inputSchema.properties?.skip || tool.inputSchema.properties?.take)
        .map((tool) => tool.name)
        .sort(),
    ).toEqual(Object.keys(apiMethods).sort());
    expect(Object.keys(paginatedToolSchemas).sort()).toEqual(Object.keys(apiMethods).sort());
  });

  describe.each(Object.entries(apiMethods))('%s', (name, method) => {
    const advertised = ajv.compile(tools.get(name)!.inputSchema);
    it('also rejects invalid pagination when the handler is called directly', async () => {
      const api = { [method]: jest.fn() };
      const { handleTool } = await import(`../../tools/${name}`);
      for (const input of [...invalidPages, { skip: Infinity }, { take: NaN }]) {
        await expect(handleTool(api, farmId, input)).rejects.toThrow();
      }
      expect(api[method]).not.toHaveBeenCalled();
    });

    it.each(invalidPages)('rejects %j without API calls', async (input) => {
      const { client, api, deps } = await connect();
      try {
        expect(advertised(input)).toBe(false);
        await expect(client.callTool({ name, arguments: input })).rejects.toMatchObject({
          code: -32602,
        });
        expectNoEffects(api, deps);
      } finally {
        await client.close();
      }
    });

    it.each([{}, { skip: 0, take: 1 }, { skip: 200, take: 200 }])(
      'forwards boundary %j unchanged',
      async (input) => {
        const { client, api } = await connect();
        try {
          expect(advertised(input)).toBe(true);
          await client.callTool({ name, arguments: input });
          const expected =
            name === 'list_pending_imports' ? { ...input, status: 'PENDING' } : input;
          expect(api[method]).toHaveBeenCalledTimes(1);
          expect(api[method]).toHaveBeenCalledWith(
            ...(name === 'list_pending_imports' ? [expected] : [farmId, expected]),
          );
        } finally {
          await client.close();
        }
      },
    );
  });
});

describe('template structural contract', () => {
  it('locks the schema fixture also checked by the API suite', () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../fixtures/template-definition.schema.json'),
        'utf8',
      ),
    );
    expect(toInputSchema(templateDefinitionSchema)).toEqual(fixture);
  });

  it.each(templateDefinitionCases)('%s matches runtime validity', (_name, definition, valid) => {
    expect(templateDefinitionSchema.safeParse(definition).success).toBe(valid);
  });

  it('rejects non-finite defaults before serialization', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(
        templateDefinitionSchema.safeParse({
          ...templateDefinition,
          fields: [
            {
              key: 'score',
              scope: 'event',
              label: 'Score',
              type: 'number',
              default: { kind: 'literal', value },
            },
          ],
        }).success,
      ).toBe(false);
    }
  });

  describe.each([
    ['create_workflow_template', 'createWorkflowTemplate'],
    ['publish_workflow_template_version', 'publishWorkflowTemplateVersion'],
  ])('%s', (name, method) => {
    const envelope =
      name === 'create_workflow_template'
        ? {}
        : { template_id: templateId, expected_current_version: 0 };
    const advertised = ajv.compile(tools.get(name)!.inputSchema);
    it.each(templateDefinitionCases)(
      '%s is checked before effects',
      async (caseName, definition, valid) => {
        const { client, api, deps } = await connect();
        const args = { ...envelope, definition };
        try {
          // Zod trims labels before checking their length; JSON Schema cannot express that transform.
          if (caseName !== 'blank name') expect(advertised(args)).toBe(valid);
          if (!valid) {
            await expect(client.callTool({ name, arguments: args })).rejects.toMatchObject({
              code: -32602,
            });
            expectNoEffects(api, deps);
          } else {
            await client.callTool({ name, arguments: args });
            const parsed = templateDefinitionSchema.parse(definition);
            expect(api[method]).toHaveBeenCalledTimes(1);
            expect(api[method]).toHaveBeenCalledWith(
              ...(name === 'create_workflow_template'
                ? [farmId, { definition: parsed }]
                : [farmId, templateId, { expected_current_version: 0, definition: parsed }]),
            );
          }
        } finally {
          await client.close();
        }
      },
    );
  });

  it.each([
    ['create_workflow_template', { definition: templateDefinition, extra: true }],
    [
      'publish_workflow_template_version',
      { template_id: templateId, expected_current_version: -1, definition: templateDefinition },
    ],
    [
      'preview_workflow',
      { request_id: farmId, template_id: templateId, inputs: { unexpected: true } },
    ],
    [
      'commit_workflow',
      {
        preview_id: farmId,
        approval: { confirmed: true, preview_hash: 'a'.repeat(64) },
        inputs: {},
      },
    ],
  ] as const)('rejects malformed %s envelope without effects', async (name, args) => {
    const { client, api, deps } = await connect();
    try {
      await expect(client.callTool({ name, arguments: args })).rejects.toMatchObject({
        code: -32602,
      });
      expectNoEffects(api, deps);
    } finally {
      await client.close();
    }
  });
});
