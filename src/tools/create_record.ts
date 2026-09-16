import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  animal_ids: z.array(z.string()).optional(),
  applied_at: z.string(),
  description: z.string().optional(),
  farm_id: z.string().optional(),
  group_ids: z.array(z.string()).optional(),
  name: z.string(),
  type: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const data: {
    animal_ids?: string[];
    applied_at: string;
    description?: string;
    group_ids?: string[];
    name: string;
    type: string;
  } = {
    applied_at: validated.applied_at,
    name: validated.name,
    type: validated.type,
  };

  if (validated.description) {
    data.description = validated.description;
  }
  if (validated.animal_ids) {
    data.animal_ids = validated.animal_ids;
  }
  if (validated.group_ids) {
    data.group_ids = validated.group_ids;
  }

  const result = await client.createRecord(targetFarmId, data);
  return {
    ...result,
    message: `Record created successfully with ID: ${result.id}`,
  };
}
