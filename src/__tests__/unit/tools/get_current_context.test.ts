import { handleTool as getCurrentContext } from '../../../tools/get_current_context';
import { setDefaultFarm } from '../../../tools/list_my_farms';

describe('get_current_context tool', () => {
  it('returns default farm from state when set', async () => {
    setDefaultFarm('farm-123');

    const result = await getCurrentContext({} as any, 'ignored-farm', {});

    expect(result).toEqual({
      default_farm_id: 'farm-123',
      message: 'Current default farm: farm-123',
    });
  });

  it('falls back to passed farm id when no default is set', async () => {
    setDefaultFarm(null);

    const result = await getCurrentContext({} as any, 'farm-xyz', {});

    expect(result).toEqual({
      default_farm_id: 'farm-xyz',
      message: 'Current default farm: farm-xyz',
    });
  });
});
