import { createMockClient } from '../testUtils';
import { handleTool as getAnimal } from '../../../tools/get_animal';

describe('get_animal tool', () => {
  it('gets animal by id', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await getAnimal(client, 'farm-1', { animal_id: 'a1' });

    expect(client.getAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({ id: 'a1' });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getAnimal(client, '' as unknown as string, { animal_id: 'a1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
