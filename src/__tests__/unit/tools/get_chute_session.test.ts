import { createMockClient } from '../testUtils';
import { handleTool as getChuteSession } from '../../../tools/get_chute_session';

describe('get_chute_session tool', () => {
  it('gets a chute session by id', async () => {
    const client = createMockClient();
    client.getChuteSession.mockResolvedValueOnce({ id: 's1', entries: [] } as any);

    const result = await getChuteSession(client, 'farm-1', { session_id: 's1' });

    expect(client.getChuteSession).toHaveBeenCalledWith('farm-1', 's1');
    expect(result.id).toBe('s1');
    expect(result.message).toBe('Chute session s1 retrieved');
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      getChuteSession(client, '' as unknown as string, { session_id: 's1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
