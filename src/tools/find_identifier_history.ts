import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  value: z.string().trim().min(1).max(128),
  type: z.string().trim().max(50).optional(),
  include_historical: z.boolean().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, ...params } = validated;
  return client.findIdentifierHistory(targetFarmId, params);
}
