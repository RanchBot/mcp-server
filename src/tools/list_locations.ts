import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  include_archived: z.boolean().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const result = await client.listLocations(targetFarmId, {
    include_archived: validated.include_archived,
  });
  return {
    ...result,
    message: `Found ${result.locations?.length || 0} location(s)`,
  };
}
