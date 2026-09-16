import { createMockClient } from '../testUtils';
import { handleTool as getRation } from '../../../tools/get_ration';

describe('get_ration tool', () => {
  it('retrieves a ration by id', async () => {
    const client = createMockClient();
    client.getRation.mockResolvedValueOnce({
      id: 'r1',
      name: 'Finishing lambs',
      ingredients: [],
      assignments: [],
    } as any);

    const result = await getRation(client, 'farm-1', { ration_id: 'r1' });

    expect(client.getRation).toHaveBeenCalledWith('farm-1', 'r1');
    expect(result.ration.id).toBe('r1');
    expect(result.message).toBe('Retrieved ration Finishing lambs');
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getRation(client, '' as unknown as string, { ration_id: 'r1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
