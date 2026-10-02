import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({ eid: z.string().min(1), farm_id: z.string().optional() });

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  return client.lookupAnimalByEid(targetFarmId, validated.eid);
}
