import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  skip: z.coerce.number().optional(),
  take: z.coerce.number().optional(),
  include_inactive: z.coerce.boolean().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { skip?: number; take?: number; include_inactive?: boolean } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }
  if (validated.include_inactive !== undefined) {
    params.include_inactive = validated.include_inactive;
  }

  const result = await client.listRations(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} ration(s)`,
  };
}
