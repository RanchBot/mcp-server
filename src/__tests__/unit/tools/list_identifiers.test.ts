import { createMockClient } from '../testUtils';
import { handleTool as listIdentifiers } from '../../../tools/list_identifiers';

describe('list_identifiers tool', () => {
  it('lists identifiers for an animal', async () => {
    const client = createMockClient();
    client.listAnimalIdentifiers.mockResolvedValueOnce({
      identifiers: [{ id: 'id1' }],
    } as any);

    const result = await listIdentifiers(client, 'farm-1', { animal_id: 'a1' });

    expect(client.listAnimalIdentifiers).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({
      identifiers: [{ id: 'id1' }],
      message: 'Found 1 identifier(s) for animal a1',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      listIdentifiers(client, '' as unknown as string, { animal_id: 'a1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
