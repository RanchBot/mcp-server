import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { createRanchBotServer, ServerDeps } from '../../serverFactory';
import { createMockClient } from './testUtils';

// The registry binds handler functions at import time, so replace one tool with a controllable
// mock before `serverFactory` (and therefore `toolRegistry`) is loaded.
jest.mock('../../tools/get_animal', () => ({ handleTool: jest.fn() }));

import { handleTool as getAnimalHandler } from '../../tools/get_animal';

const mockHandler = getAnimalHandler as jest.MockedFunction<typeof getAnimalHandler>;

const depsWith = (): ServerDeps => ({
  getClient: jest.fn().mockResolvedValue(createMockClient()),
  resolveDefaultFarm: jest.fn().mockResolvedValue('farm-1'),
  persistDefaultFarm: jest.fn().mockResolvedValue(undefined),
});

const connect = async (deps: ServerDeps) => {
  const server = createRanchBotServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
};

const callGetAnimal = (client: Client) =>
  client.callTool({ name: 'get_animal', arguments: { animal_id: 'animal-1' } });

/** Capture a rejection as an error object (the client error's message is non-enumerable). */
const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
    throw new Error('expected the call to reject');
  } catch (error: any) {
    return error as { code: number; message: string };
  }
};

describe('tool dispatch result handling', () => {
  it('serializes an object result as pretty-printed JSON', async () => {
    const payload = { id: 'animal-1', name: 'Bess' };
    mockHandler.mockResolvedValue(payload);
    const client = await connect(depsWith());
    try {
      const result = await callGetAnimal(client);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect((result as any).content).toEqual([
        { type: 'text', text: JSON.stringify(payload, null, 2) },
      ]);
    } finally {
      await client.close();
    }
  });

  it('returns a string result unchanged', async () => {
    mockHandler.mockResolvedValue('plain text result');
    const client = await connect(depsWith());
    try {
      const result = await callGetAnimal(client);
      expect((result as any).content).toEqual([{ type: 'text', text: 'plain text result' }]);
    } finally {
      await client.close();
    }
  });

  it('preserves an McpError thrown by the handler', async () => {
    mockHandler.mockRejectedValue(new McpError(ErrorCode.InvalidRequest, 'handler rejected'));
    const client = await connect(depsWith());
    try {
      const error = await rejection(callGetAnimal(client));
      expect(error.code).toBe(ErrorCode.InvalidRequest);
      expect(error.message).toContain('handler rejected');
    } finally {
      await client.close();
    }
  });

  it('wraps an ordinary handler failure in InternalError', async () => {
    mockHandler.mockRejectedValue(new Error('kaboom'));
    const client = await connect(depsWith());
    try {
      const error = await rejection(callGetAnimal(client));
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Error executing tool get_animal: kaboom');
    } finally {
      await client.close();
    }
  });
});
