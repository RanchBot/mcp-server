import { createMockClient } from '../testUtils';
import { handleTool as listChuteSessions } from '../../../tools/list_chute_sessions';

describe('list_chute_sessions tool', () => {
  it('lists chute sessions with a status filter', async () => {
    const client = createMockClient();
    client.listChuteSessions.mockResolvedValueOnce({
      total: 1,
      records: [{ id: 's1', name: 'Weigh Day', status: 'COMPLETED' }],
    } as any);

    const result = await listChuteSessions(client, 'farm-1', { status: 'COMPLETED' });

    expect(client.listChuteSessions).toHaveBeenCalledWith('farm-1', { status: 'COMPLETED' });
    expect(result.records).toHaveLength(1);
    expect(result.message).toBe('Found 1 chute session(s)');
  });

  it('passes pagination params and prefers an explicit farm_id', async () => {
    const client = createMockClient();
    client.listChuteSessions.mockResolvedValueOnce({ total: 0, records: [] } as any);

    await listChuteSessions(client, 'default-farm', { farm_id: 'farm-2', skip: 5, take: 10 });

    expect(client.listChuteSessions).toHaveBeenCalledWith('farm-2', { skip: 5, take: 10 });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listChuteSessions(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
