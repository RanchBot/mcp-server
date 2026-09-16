import { createMockClient } from '../testUtils';
import { getDefaultFarm, handleTool, setDefaultFarm } from '../../../tools/list_my_farms';

describe('list_my_farms tool', () => {
  it('returns farms with total and message', async () => {
    const client = createMockClient();
    client.getFarms.mockResolvedValue({
      farms: [{ id: 'farm-1' }, { id: 'farm-2' }],
      total: 2,
    } as any);

    const result = await handleTool(client, 'farm-ignored', {});

    expect(client.getFarms).toHaveBeenCalled();
    expect(result).toEqual({
      farms: [{ id: 'farm-1' }, { id: 'farm-2' }],
      total: 2,
      message: 'Found 2 farm(s)',
    });
  });

  it('falls back to farms.length when total is missing', async () => {
    const client = createMockClient();
    client.getFarms.mockResolvedValue({
      farms: [{ id: 'farm-1' }],
    } as any);

    const result = await handleTool(client, 'farm-ignored', {});

    expect(result.total).toBe(1);
  });

  it('tracks default farm id via setters/getters', () => {
    setDefaultFarm('farm-123');
    expect(getDefaultFarm()).toBe('farm-123');

    setDefaultFarm(null);
    expect(getDefaultFarm()).toBeNull();
  });
});
