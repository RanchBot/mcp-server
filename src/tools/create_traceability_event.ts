import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  request_key: z.string().min(1).max(200),
  source: z.string().nullable().optional(),
  payload: z.record(z.string(), z.any()),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const result = await client.createTraceabilityEvent(targetFarmId, {
    request_key: validated.request_key,
    source: validated.source,
    payload: validated.payload,
  });
  return { ...result, message: `Traceability event created with ID: ${result.event?.id}` };
}
