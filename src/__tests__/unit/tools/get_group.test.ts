import { createMockClient } from '../testUtils';
import { handleTool as getGroup } from '../../../tools/get_group';

describe('get_group tool', () => {
  it('gets group by id', async () => {
    const client = createMockClient();
    client.getGroup.mockResolvedValueOnce({ id: 'g1' } as any);

    const result = await getGroup(client, 'farm-1', { group_id: 'g1' });

    expect(client.getGroup).toHaveBeenCalledWith('farm-1', 'g1');
    expect(result).toEqual({ id: 'g1' });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getGroup(client, '' as unknown as string, { group_id: 'g1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
