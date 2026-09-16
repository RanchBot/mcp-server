import { createMockClient } from '../testUtils';
import { handleTool as getRecord } from '../../../tools/get_record';

describe('get_record tool', () => {
  it('gets record by id', async () => {
    const client = createMockClient();
    client.getRecord.mockResolvedValueOnce({ id: 'r1' } as any);

    const result = await getRecord(client, 'farm-1', { record_id: 'r1' });

    expect(client.getRecord).toHaveBeenCalledWith('farm-1', 'r1');
    expect(result).toEqual({ id: 'r1' });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getRecord(client, '' as unknown as string, { record_id: 'r1' })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
