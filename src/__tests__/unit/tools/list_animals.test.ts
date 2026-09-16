import { createMockClient } from '../testUtils';
import { handleTool as listAnimals } from '../../../tools/list_animals';

describe('list_animals tool', () => {
  it('lists animals with optional pagination', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValueOnce({
      records: [{ id: 'a1' }],
    } as any);

    const result = await listAnimals(client, 'farm-1', {
      skip: '1',
      take: '10',
    });

    expect(client.listAnimals).toHaveBeenCalledWith('farm-1', {
      skip: 1,
      take: 10,
    });
    expect(result).toEqual({
      records: [{ id: 'a1' }],
      message: 'Found 1 animal(s)',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listAnimals(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
