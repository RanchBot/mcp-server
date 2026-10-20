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

  it('forwards additive animal_ids and reports an ensured-membership outcome', async () => {
    const client = createMockClient();
    client.updateGroup.mockResolvedValueOnce({ id: 'g1' } as any);

    const result = await updateGroup(client, 'farm-1', {
      group_id: 'g1',
      animal_ids: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(client.updateGroup).toHaveBeenCalledWith('farm-1', 'g1', {
      animal_ids: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(result.message).toBe('Ensured the requested animals belong to group g1');
  });

  it('omits animal_ids when not provided', async () => {
    const client = createMockClient();
    client.updateGroup.mockResolvedValueOnce({ id: 'g1' } as any);

    await updateGroup(client, 'farm-1', { group_id: 'g1', name: 'New' });

    expect(client.updateGroup).toHaveBeenCalledWith('farm-1', 'g1', { name: 'New' });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(updateGroup(client, '' as unknown as string, { group_id: 'g1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
