import { RanchBotApiClient } from '../client';

let defaultFarmId: string | null = null;

export async function handleTool(client: RanchBotApiClient, _farmId: string, _args: any) {
  const result = await client.getFarms();
  const farms = result.farms || [];
  return {
    farms,
    total: result.total || farms.length,
    message: `Found ${farms.length} farm(s)`,
  };
}

export function setDefaultFarm(farmId: string | null) {
  defaultFarmId = farmId;
}

export function getDefaultFarm(): string | null {
  return defaultFarmId;
}
