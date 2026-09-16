import { createMockClient } from '../testUtils';
import { handleTool as listRations } from '../../../tools/list_rations';

describe('list_rations tool', () => {
  it('lists rations and reports the count', async () => {
    const client = createMockClient();
    client.listRations.mockResolvedValueOnce({
      total: 1,
      records: [{ id: 'r1', name: 'Finishing lambs', unit: 'lb' }],
    } as any);

    const result = await listRations(client, 'farm-1', {});

    expect(client.listRations).toHaveBeenCalledWith('farm-1', {});
    expect(result.records).toHaveLength(1);
    expect(result.message).toBe('Found 1 ration(s)');
  });

  it('passes filters and prefers an explicit farm_id', async () => {
    const client = createMockClient();
    client.listRations.mockResolvedValueOnce({ total: 0, records: [] } as any);

    await listRations(client, 'default-farm', {
      farm_id: 'farm-2',
      skip: 5,
      take: 10,
      include_inactive: true,
    });

    expect(client.listRations).toHaveBeenCalledWith('farm-2', {
      skip: 5,
      take: 10,
      include_inactive: true,
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listRations(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
