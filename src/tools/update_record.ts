import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  applied_at: z.string().optional(),
  description: z.string().optional(),
  farm_id: z.string().optional(),
  name: z.string().optional(),
  record_id: z.string(),
  type: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const data: {
    applied_at?: string;
    description?: string;
    name?: string;
    type?: string;
  } = {};

  if (validated.applied_at) {
    data.applied_at = validated.applied_at;
  }
  if (validated.description !== undefined) {
    data.description = validated.description;
  }
  if (validated.name) {
    data.name = validated.name;
  }
  if (validated.type) {
    data.type = validated.type;
  }

  const result = await client.updateRecord(targetFarmId, validated.record_id, data);
  return {
    ...result,
    message: `Record ${validated.record_id} updated successfully`,
  };
}
