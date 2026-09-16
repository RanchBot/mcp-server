import { createMockClient } from '../testUtils';
import { handleTool as deleteGroup } from '../../../tools/delete_group';

describe('delete_group tool', () => {
  it('deletes group and returns message', async () => {
    const client = createMockClient();
    client.deleteGroup.mockResolvedValueOnce(undefined as any);

    const result = await deleteGroup(client, 'farm-1', { group_id: 'g1' });

    expect(client.deleteGroup).toHaveBeenCalledWith('farm-1', 'g1');
    expect(result).toEqual({
      message: 'Group g1 deleted successfully',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(deleteGroup(client, '' as unknown as string, { group_id: 'g1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
