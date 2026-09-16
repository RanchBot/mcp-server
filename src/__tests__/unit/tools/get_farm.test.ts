import { createMockClient } from '../testUtils';
import { handleTool as getFarm } from '../../../tools/get_farm';

describe('get_farm tool', () => {
  it('fetches farm using provided farm_id arg', async () => {
    const client = createMockClient();
    client.getFarm.mockResolvedValueOnce({ id: 'farm-1' } as any);

    const result = await getFarm(client, 'ignored', { farm_id: 'farm-1' });

    expect(client.getFarm).toHaveBeenCalledWith('farm-1');
    expect(result).toEqual({ id: 'farm-1' });
  });

  it('uses default farm id parameter when arg is missing', async () => {
    const client = createMockClient();
    client.getFarm.mockResolvedValueOnce({ id: 'farm-xyz' } as any);

    const result = await getFarm(client, 'farm-xyz', {});

    expect(client.getFarm).toHaveBeenCalledWith('farm-xyz');
    expect(result).toEqual({ id: 'farm-xyz' });
  });

  it('throws when no farm id is available', async () => {
    const client = createMockClient();

    await expect(
      // cast to satisfy typing while simulating missing farm id
      getFarm(client, '' as unknown as string, {}),
    ).rejects.toThrow('farm_id is required');
  });
});
