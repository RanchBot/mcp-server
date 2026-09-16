import { z } from 'zod';
import { AnimalInventoryStatus, RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  skip: z.coerce.number().optional(),
  take: z.coerce.number().optional(),
  inventory_status: z.enum(['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED', 'ALL']).optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { skip?: number; take?: number; inventory_status?: AnimalInventoryStatus | 'ALL' } =
    {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }

  if (validated.inventory_status !== undefined)
    params.inventory_status = validated.inventory_status;

  const result = await client.listAnimals(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} animal(s)`,
  };
}
