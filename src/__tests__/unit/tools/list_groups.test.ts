import { createMockClient } from '../testUtils';
import { handleTool as listGroups } from '../../../tools/list_groups';

describe('list_groups tool', () => {
  it('lists groups for a farm', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({
      groups: [{ id: 'g1' }],
    } as any);

    const result = await listGroups(client, 'farm-1', {});

    expect(client.listGroups).toHaveBeenCalledWith('farm-1');
    expect(result).toEqual({
      groups: [{ id: 'g1' }],
      message: 'Found 1 group(s)',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listGroups(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
