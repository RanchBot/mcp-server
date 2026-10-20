import { createMockClient } from '../testUtils';
import { handleTool as listRecords } from '../../../tools/list_records';

describe('list_records tool', () => {
  it('lists records with optional filters', async () => {
    const client = createMockClient();
    client.listRecords.mockResolvedValueOnce({
      records: [{ id: 'r1' }],
    } as any);

    const result = await listRecords(client, 'farm-1', {
      skip: 1,
      take: 10,
      type: 'HEALTH',
    });

    expect(client.listRecords).toHaveBeenCalledWith('farm-1', {
      skip: 1,
      take: 10,
      type: 'HEALTH',
    });
    expect(result).toEqual({
      records: [{ id: 'r1' }],
      message: 'Found 1 record(s)',
    });
  });

  it('forwards bounded-history parameters', async () => {
    const client = createMockClient();
    client.listRecords.mockResolvedValueOnce({ records: [] } as any);

    await listRecords(client, 'farm-1', {
      animal_id: '11111111-1111-4111-8111-111111111111',
      include_group_context: true,
      applied_from: '2026-10-10T00:00:00Z',
      applied_before: '2026-10-11T00:00:00Z',
    });

    expect(client.listRecords).toHaveBeenCalledWith('farm-1', {
      animal_id: '11111111-1111-4111-8111-111111111111',
      include_group_context: true,
      applied_from: '2026-10-10T00:00:00Z',
      applied_before: '2026-10-11T00:00:00Z',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listRecords(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
