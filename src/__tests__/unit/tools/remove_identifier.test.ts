import { createMockClient } from '../testUtils';
import { handleTool as removeIdentifier } from '../../../tools/remove_identifier';

describe('remove_identifier tool', () => {
  it('removes identifier from animal', async () => {
    const client = createMockClient();
    client.removeAnimalIdentifier.mockResolvedValueOnce(undefined as any);

    const result = await removeIdentifier(client, 'farm-1', {
      animal_id: 'a1',
      identifier_id: 'id1',
    });

    expect(client.removeAnimalIdentifier).toHaveBeenCalledWith('farm-1', 'a1', 'id1');
    expect(result).toEqual({
      message: 'Identifier id1 removed from animal a1',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      removeIdentifier(client, '' as unknown as string, {
        animal_id: 'a1',
        identifier_id: 'id1',
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
