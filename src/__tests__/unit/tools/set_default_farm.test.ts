import { handleTool as setDefaultFarmTool } from '../../../tools/set_default_farm';
import { getDefaultFarm } from '../../../tools/list_my_farms';

const farmId = '00000000-0000-4000-8000-000000000042';

describe('set_default_farm tool', () => {
  it('returns the explicit farm id without persisting it', async () => {
    const before = getDefaultFarm();
    const result = await setDefaultFarmTool({}, 'ignored', { farm_id: farmId });
    expect(result).toEqual({
      default_farm_id: farmId,
      message: `Default farm set to ${farmId}`,
    });
    expect(getDefaultFarm()).toBe(before);
  });

  it.each([{}, { farm_id: '' }, { farm_id: 42 }, { farm_id: 'not-a-uuid' }])(
    'rejects %j even with a saved default',
    async (args) => {
      await expect(setDefaultFarmTool({}, farmId, args)).rejects.toThrow();
    },
  );
});
