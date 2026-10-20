import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string().nullable(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  if (!validated.location_id) {
    await client.clearHomeLocation(targetFarmId);
    return { home_location_id: null, message: 'Home premises cleared' };
  }
  const result = await client.setHomeLocation(targetFarmId, validated.location_id);
  return { ...result, message: `Home premises set to ${validated.location_id}` };
}
