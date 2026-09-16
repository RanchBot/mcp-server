import { createMockClient } from '../testUtils';
import { handleTool as getFeeding } from '../../../tools/get_feeding';

describe('get_feeding tool', () => {
  it('retrieves a feeding by id', async () => {
    const client = createMockClient();
    client.getFeeding.mockResolvedValueOnce({
      id: 'f1',
      ingredients: [],
      deliveries: [],
    } as any);

    const result = await getFeeding(client, 'farm-1', { feeding_id: 'f1' });

    expect(client.getFeeding).toHaveBeenCalledWith('farm-1', 'f1');
    expect(result.feeding.id).toBe('f1');
    expect(result.message).toBe('Retrieved feeding f1');
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getFeeding(client, '' as unknown as string, { feeding_id: 'f1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
