import { createMockClient } from '../testUtils';
import { handleTool as deleteAnimalTool } from '../../../tools/delete_animal';

describe('delete_animal tool', () => {
  it('deletes animal and returns message', async () => {
    const client = createMockClient();
    client.deleteAnimal.mockResolvedValueOnce(undefined as any);

    const result = await deleteAnimalTool(client, 'farm-1', {
      animal_id: 'a1',
    });

    expect(client.deleteAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({
      message: 'Animal a1 deleted successfully',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      deleteAnimalTool(client, '' as unknown as string, { animal_id: 'a1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
