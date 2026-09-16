import { createMockClient } from '../testUtils';
import { handleTool as restoreGroup } from '../../../tools/restore_group';

describe('restore_group tool', () => {
  it('restores group and returns message with the restored group', async () => {
    const client = createMockClient();
    const restored = { id: 'g1', name: 'North Pasture', is_active: true };
    client.restoreGroup.mockResolvedValueOnce(restored as any);

    const result = await restoreGroup(client, 'farm-1', { group_id: 'g1' });

    expect(client.restoreGroup).toHaveBeenCalledWith('farm-1', 'g1');
    expect(result).toEqual({
      message: 'Group g1 restored successfully',
      group: restored,
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(restoreGroup(client, '' as unknown as string, { group_id: 'g1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
