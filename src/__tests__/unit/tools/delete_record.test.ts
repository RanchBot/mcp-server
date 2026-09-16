import { createMockClient } from '../testUtils';
import { handleTool as deleteRecord } from '../../../tools/delete_record';

describe('delete_record tool', () => {
  it('deletes record and returns message', async () => {
    const client = createMockClient();
    client.deleteRecord.mockResolvedValueOnce(undefined as any);

    const result = await deleteRecord(client, 'farm-1', { record_id: 'r1' });

    expect(client.deleteRecord).toHaveBeenCalledWith('farm-1', 'r1');
    expect(result).toEqual({
      message: 'Record r1 deleted successfully',
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      deleteRecord(client, '' as unknown as string, { record_id: 'r1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
