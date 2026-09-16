import { getDefaultFarm } from './list_my_farms';

export async function handleTool(_client: any, farmId: string, _args: any) {
  const defaultFarmId = getDefaultFarm() || farmId;

  return {
    default_farm_id: defaultFarmId,
    message: defaultFarmId
      ? `Current default farm: ${defaultFarmId}`
      : 'No default farm set. Use set_default_farm to set one.',
  };
}
