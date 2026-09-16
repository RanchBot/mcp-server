import { createMockClient } from '../testUtils';
import { handleTool as createAnimalTool } from '../../../tools/create_animal';

describe('create_animal tool', () => {
  it('creates animal with optional metadata', async () => {
    const client = createMockClient();
    client.createAnimal.mockResolvedValueOnce({
      id: 'a1',
    } as any);

    const result = await createAnimalTool(client, 'farm-1', {
      metadata: { tag: '123' },
    });

    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', {
      metadata: { tag: '123' },
    });
    expect(result).toEqual({
      id: 'a1',
      message: 'Animal created successfully with ID: a1',
    });
  });

  it('packs described profile fields into canonical metadata', async () => {
    const client = createMockClient();
    client.createAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await createAnimalTool(client, 'farm-1', {
      name: 'Rodrigo',
      kind: 'ram lamb',
      color: 'white',
      notes: 'bottle-fed',
    });

    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', {
      metadata: { name: 'Rodrigo', kind: 'ram lamb', color: 'white', notes: 'bottle-fed' },
    });
    expect(result).toEqual({ id: 'a1', message: 'Animal created successfully with ID: a1' });
  });

  it('merges explicit metadata over the described profile fields', async () => {
    const client = createMockClient();
    client.createAnimal.mockResolvedValueOnce({ id: 'a2' } as any);

    await createAnimalTool(client, 'farm-1', {
      breed: 'Angus',
      metadata: { breed: 'Hereford', extra: 1 },
    });

    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', {
      metadata: { breed: 'Hereford', extra: 1 },
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(createAnimalTool(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
