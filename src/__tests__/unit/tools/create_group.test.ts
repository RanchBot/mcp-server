import { createMockClient } from '../testUtils';
import { handleTool as createGroup } from '../../../tools/create_group';

describe('create_group tool', () => {
  it('creates group with optional description', async () => {
    const client = createMockClient();
    client.createGroup.mockResolvedValueOnce({ id: 'g1' } as any);

    const result = await createGroup(client, 'farm-1', {
      name: 'Group',
      description: 'desc',
    });

    expect(client.createGroup).toHaveBeenCalledWith('farm-1', {
      name: 'Group',
      description: 'desc',
    });
    expect(result).toEqual({
      id: 'g1',
      message: 'Group created successfully with ID: g1',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(createGroup(client, '' as unknown as string, { name: 'Group' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
