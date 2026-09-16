import { createMockClient } from '../testUtils';
import { handleTool as findAnimalByIdentifier } from '../../../tools/find_animal_by_identifier';

describe('find_animal_by_identifier tool', () => {
  it('finds existing animal and returns message', async () => {
    const client = createMockClient();
    client.findOrCreateAnimalByEid.mockResolvedValueOnce({
      id: 'a1',
      created: false,
    } as any);

    const result = await findAnimalByIdentifier(client, 'farm-1', {
      eid: 'EID123',
    });

    expect(client.findOrCreateAnimalByEid).toHaveBeenCalledWith('farm-1', 'EID123');
    expect(result.message).toBe('Animal found with EID EID123');
  });

  it('creates new animal and returns message', async () => {
    const client = createMockClient();
    client.findOrCreateAnimalByEid.mockResolvedValueOnce({
      id: 'a2',
      created: true,
    } as any);

    const result = await findAnimalByIdentifier(client, 'farm-1', {
      eid: 'EID999',
    });

    expect(result.message).toBe('Animal created with EID EID999');
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      findAnimalByIdentifier(client, '' as unknown as string, {
        eid: 'EID123',
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
