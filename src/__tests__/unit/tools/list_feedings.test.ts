import { createMockClient } from '../testUtils';
import { handleTool as listFeedings } from '../../../tools/list_feedings';

describe('list_feedings tool', () => {
  it('lists feedings with a status filter', async () => {
    const client = createMockClient();
    client.listFeedings.mockResolvedValueOnce({
      total: 1,
      records: [{ id: 'f1', ration_name: 'Finishing lambs', status: 'COMPLETED' }],
    } as any);

    const result = await listFeedings(client, 'farm-1', { status: 'COMPLETED' });

    expect(client.listFeedings).toHaveBeenCalledWith('farm-1', { status: 'COMPLETED' });
    expect(result.records).toHaveLength(1);
    expect(result.message).toBe('Found 1 feeding(s)');
  });

  it('passes pagination and since, preferring an explicit farm_id', async () => {
    const client = createMockClient();
    client.listFeedings.mockResolvedValueOnce({ total: 0, records: [] } as any);

    await listFeedings(client, 'default-farm', {
      farm_id: 'farm-2',
      skip: 5,
      take: 10,
      since: '2026-06-01T00:00:00Z',
    });

    expect(client.listFeedings).toHaveBeenCalledWith('farm-2', {
      skip: 5,
      take: 10,
      since: '2026-06-01T00:00:00Z',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listFeedings(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
