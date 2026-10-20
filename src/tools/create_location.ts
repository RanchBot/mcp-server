import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  name: z.string(),
  parent_id: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  legal_land_description: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  province_state: z.string().nullable().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, ...data } = validated;
  const result = await client.createLocation(targetFarmId, data);
  return { ...result, message: `Location created with ID: ${result.location?.id}` };
}
