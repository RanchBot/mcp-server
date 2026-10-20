import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string(),
  expected_version: z.number().int().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const result = await client.archiveLocation(
    targetFarmId,
    validated.location_id,
    validated.expected_version,
  );
  return { ...result, message: `Location ${validated.location_id} archived` };
}
