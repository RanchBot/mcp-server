import { createMockClient } from '../testUtils';
import { handleTool } from '../../../tools/lookup_animal_by_eid';
import { handleTool as findOrCreate } from '../../../tools/find_or_create_animal_by_eid';
import { handleTool as findByIdentifier } from '../../../tools/find_animal_by_identifier';
import { registerTools } from '../../../tools';
import { getToolHandler } from '../../../toolRegistry';

it.each(['not found', 'ambiguous'])('propagates %s without creation', async (message) => {
  const client = createMockClient();
  client.lookupAnimalByEid.mockRejectedValue(new Error(message));
  await expect(handleTool(client, 'default', { farm_id: 'selected', eid: '001' })).rejects.toThrow(
    message,
  );
  expect(client.lookupAnimalByEid).toHaveBeenCalledWith('selected', '001');
  expect(client.findOrCreateAnimalByEid).not.toHaveBeenCalled();
  expect(client.createAnimal).not.toHaveBeenCalled();
});

it('reads the unique animal and rejects missing farm or EID before a request', async () => {
  const client = createMockClient();
  client.lookupAnimalByEid.mockResolvedValue({ id: 'animal' });
  expect(await handleTool(client, 'farm', { eid: '001' })).toEqual({ id: 'animal' });
  await expect(handleTool(client, '', { eid: '001' })).rejects.toThrow('farm_id is required');
  await expect(handleTool(client, 'farm', { eid: '' })).rejects.toThrow();
  expect(client.lookupAnimalByEid).toHaveBeenCalledTimes(1);
});

it('keeps intentional creation explicit', async () => {
  const client = createMockClient();
  client.findOrCreateAnimalByEid.mockResolvedValue({ animal: { id: 'new' }, created: true });
  expect(await findOrCreate(client, 'farm', { eid: '001' })).toMatchObject({ created: true });
  expect(client.lookupAnimalByEid).not.toHaveBeenCalled();
});

it('publishes accurate schemas, annotations, and handler mappings', () => {
  const tools = new Map(registerTools().map((t) => [t.name, t]));
  const lookup = tools.get('lookup_animal_by_eid')!;
  expect(lookup.inputSchema.required).toEqual(['eid']);
  expect(lookup.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
  expect(getToolHandler(lookup.name)).toBe(handleTool);
  for (const name of ['find_or_create_animal_by_eid', 'find_animal_by_identifier']) {
    expect(tools.get(name)?.annotations?.readOnlyHint).toBe(false);
    expect(tools.get(name)?.description).toMatch(/creates an animal/);
  }
  expect(getToolHandler('find_or_create_animal_by_eid')).toBe(findOrCreate);
  expect(getToolHandler('find_animal_by_identifier')).toBe(findByIdentifier);
  expect(tools.get('find_animal_by_identifier')?.description).toMatch(/DEPRECATED/);
});
