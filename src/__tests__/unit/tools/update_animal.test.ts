import { createMockClient } from '../testUtils';
import { handleTool as updateAnimalTool } from '../../../tools/update_animal';

describe('update_animal tool', () => {
  it('updates animal metadata', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({ metadata: {} } as any);
    client.updateAnimal.mockResolvedValueOnce({
      id: 'a1',
    } as any);

    const result = await updateAnimalTool(client, 'farm-1', {
      animal_id: 'a1',
      metadata: { tag: '123' },
    });

    expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'a1', {
      metadata: { tag: '123' },
    });
    expect(result).toEqual({
      id: 'a1',
      message: 'Animal a1 updated successfully',
    });
  });

  it('packs described profile fields and merges them into the existing metadata', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({
      id: 'a1',
      metadata: { kind: 'cow', color: 'black' },
    } as any);
    client.updateAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await updateAnimalTool(client, 'farm-1', {
      animal_id: 'a1',
      breed: 'Angus',
    });

    expect(client.getAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'a1', {
      metadata: { kind: 'cow', color: 'black', breed: 'Angus' },
    });
    expect(result).toEqual({ id: 'a1', message: 'Animal a1 updated successfully' });
  });

  it('leaves metadata untouched when no profile fields or metadata are supplied', async () => {
    const client = createMockClient();
    client.updateAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    await updateAnimalTool(client, 'farm-1', { animal_id: 'a1' });

    expect(client.getAnimal).not.toHaveBeenCalled();
    expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'a1', { metadata: undefined });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      updateAnimalTool(client, '' as unknown as string, { animal_id: 'a1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
