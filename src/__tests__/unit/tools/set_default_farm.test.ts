import { handleTool as setDefaultFarmTool } from '../../../tools/set_default_farm';
import { getDefaultFarm } from '../../../tools/list_my_farms';

// The handler only shapes the response; persistence is the transport's job
// (serverFactory calls deps.persistDefaultFarm before dispatching — DB on the
// hosted http path, in-memory on stdio), so the handler must NOT touch the
// module-level default-farm global. These tests lock that contract in: a
// regression that re-adds a global write here would re-create the multi-tenant
// hazard the factory seam exists to prevent.
describe('set_default_farm tool', () => {
  it('returns the farm id from args without persisting it', async () => {
    const before = getDefaultFarm();
    const result = await setDefaultFarmTool({} as any, 'ignored', {
      farm_id: 'farm-123',
    });

    expect(result).toEqual({
      default_farm_id: 'farm-123',
      message: 'Default farm set to farm-123',
    });
    expect(getDefaultFarm()).toBe(before);
  });

  it('returns the passed farm id when args.farm_id is not provided', async () => {
    const before = getDefaultFarm();
    const result = await setDefaultFarmTool({} as any, 'farm-xyz', {});

    expect(result.default_farm_id).toBe('farm-xyz');
    expect(getDefaultFarm()).toBe(before);
  });

  it('throws when no farm id is available', async () => {
    await expect(setDefaultFarmTool({} as any, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
});
