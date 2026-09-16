import { createMockClient } from '../testUtils';
import { handleTool as addIdentifier } from '../../../tools/add_identifier';

describe('add_identifier tool', () => {
  it('adds identifier to animal', async () => {
    const client = createMockClient();
    client.addAnimalIdentifier.mockResolvedValueOnce({
      id: 'id1',
    } as any);

    const result = await addIdentifier(client, 'farm-1', {
      animal_id: 'a1',
      type: 'EID',
      value: '123',
      is_primary: true,
    });

    expect(client.addAnimalIdentifier).toHaveBeenCalledWith('farm-1', 'a1', {
      type: 'EID',
      value: '123',
      is_primary: true,
    });
    expect(result).toEqual({
      id: 'id1',
      message: 'Identifier added to animal a1',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      addIdentifier(client, '' as unknown as string, {
        animal_id: 'a1',
        type: 'EID',
        value: '123',
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
