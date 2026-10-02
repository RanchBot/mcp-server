import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  eid: z.string(),
  farm_id: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const result = await client.findOrCreateAnimalByEid(targetFarmId, validated.eid);
  return {
    ...result,
    message: result.created
      ? `Animal created with EID ${validated.eid}`
      : `Animal found with EID ${validated.eid}`,
  };
}
