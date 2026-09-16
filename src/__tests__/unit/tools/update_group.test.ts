import { createMockClient } from '../testUtils';
import { handleTool as updateGroup } from '../../../tools/update_group';

describe('update_group tool', () => {
  it('updates group name and description', async () => {
    const client = createMockClient();
    client.updateGroup.mockResolvedValueOnce({ id: 'g1' } as any);

    const result = await updateGroup(client, 'farm-1', {
      group_id: 'g1',
      name: 'New',
      description: 'desc',
    });

    expect(client.updateGroup).toHaveBeenCalledWith('farm-1', 'g1', {
      name: 'New',
      description: 'desc',
    });
    expect(result).toEqual({
      id: 'g1',
      message: 'Group g1 updated successfully',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(updateGroup(client, '' as unknown as string, { group_id: 'g1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
