import { createMockClient } from '../testUtils';
import { handleTool as updateRecord } from '../../../tools/update_record';

describe('update_record tool', () => {
  it('updates record with provided fields', async () => {
    const client = createMockClient();
    client.updateRecord.mockResolvedValueOnce({ id: 'r1' } as any);

    const result = await updateRecord(client, 'farm-1', {
      record_id: 'r1',
      applied_at: '2024-01-02T00:00:00Z',
      name: 'Updated',
      type: 'FEED',
      description: 'changed',
    });

    expect(client.updateRecord).toHaveBeenCalledWith('farm-1', 'r1', {
      applied_at: '2024-01-02T00:00:00Z',
      name: 'Updated',
      type: 'FEED',
      description: 'changed',
    });
    expect(result).toEqual({
      id: 'r1',
      message: 'Record r1 updated successfully',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      updateRecord(client, '' as unknown as string, { record_id: 'r1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
