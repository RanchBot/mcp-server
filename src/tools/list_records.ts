import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  skip: z.coerce.number().optional(),
  take: z.coerce.number().optional(),
  type: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { skip?: number; take?: number; type?: string } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }
  if (validated.type) {
    params.type = validated.type;
  }

  const result = await client.listRecords(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} record(s)`,
  };
}
