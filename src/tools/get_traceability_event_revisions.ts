import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({ farm_id: z.string().optional(), event_id: z.string() });

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  return client.getTraceabilityEventRevisions(targetFarmId, validated.event_id);
}
