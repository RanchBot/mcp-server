import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  event_id: z.string(),
  request_key: z.string().min(1).max(200),
  expected_revision: z.number().int(),
  reason: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, event_id, ...data } = validated;
  const result = await client.voidTraceabilityEvent(targetFarmId, event_id, data);
  return { ...result, message: `Traceability event ${event_id} voided` };
}
