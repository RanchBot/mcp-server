import { createMockClient } from '../testUtils';
import { handleTool as createRecord } from '../../../tools/create_record';

describe('create_record tool', () => {
  it('creates record with all fields', async () => {
    const client = createMockClient();
    client.createRecord.mockResolvedValueOnce({ id: 'r1' } as any);

    const result = await createRecord(client, 'farm-1', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      description: 'desc',
      animal_ids: ['a1'],
      group_ids: ['g1'],
    });

    expect(client.createRecord).toHaveBeenCalledWith('farm-1', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      description: 'desc',
      animal_ids: ['a1'],
      group_ids: ['g1'],
    });
    expect(result).toEqual({
      id: 'r1',
      message: 'Record created successfully with ID: r1',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      createRecord(client, '' as unknown as string, {
        applied_at: '2024-01-01T00:00:00Z',
        name: 'Record',
        type: 'HEALTH',
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
