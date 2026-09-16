import { generatedCrudTools } from '../../../generated/toolContracts';
import { handleTool as createAnimal } from '../../../tools/create_animal';
import { handleTool as listAnimals } from '../../../tools/list_animals';
import { handleTool as updateAnimal } from '../../../tools/update_animal';
import { createMockClient } from '../testUtils';

it('passes inventory status independently of metadata and exposes history discovery in generated tools', async () => {
  const client = createMockClient();
  client.createAnimal.mockResolvedValue({ id: 'old-ewe' } as any);
  client.updateAnimal.mockResolvedValue({ id: 'old-ewe' } as any);
  client.listAnimals.mockResolvedValue({ total: 1, records: [{ id: 'old-ewe' }] } as any);
  await createAnimal(client, 'farm-1', { inventory_status: 'UNKNOWN', name: 'Old ewe' });
  await updateAnimal(client, 'farm-1', { animal_id: 'old-ewe', inventory_status: 'SOLD' });
  const list = await listAnimals(client, 'farm-1', { inventory_status: 'ALL' });
  expect(client.createAnimal).toHaveBeenCalledWith('farm-1', {
    inventory_status: 'UNKNOWN',
    metadata: { name: 'Old ewe' },
  });
  expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'old-ewe', {
    inventory_status: 'SOLD',
    metadata: undefined,
  });
  expect(client.getAnimal).not.toHaveBeenCalled();
  expect(client.listAnimals).toHaveBeenCalledWith('farm-1', { inventory_status: 'ALL' });
  expect(list.message).toBe('Found 1 animal(s)');
  await expect(createAnimal(client, 'farm-1', { inventory_status: 'ALL' })).rejects.toThrow();
  await expect(listAnimals(client, 'farm-1', { inventory_status: 'sold' })).rejects.toThrow();
  expect(client.createAnimal).toHaveBeenCalledTimes(1);
  for (const name of ['create_animal', 'update_animal', 'list_animals']) {
    const schema = generatedCrudTools.find((tool) => tool.name === name)!.inputSchema;
    expect(schema.properties!.inventory_status).toMatchObject({
      enum:
        name === 'list_animals'
          ? ['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED', 'ALL']
          : ['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED'],
    });
  }
});
