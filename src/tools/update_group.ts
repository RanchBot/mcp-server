import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  description: z.string().optional(),
  farm_id: z.string().optional(),
  group_id: z.string(),
  name: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const data: { description?: string; name?: string } = {};
  if (validated.name !== undefined) {
    data.name = validated.name;
  }
  if (validated.description !== undefined) {
    data.description = validated.description;
  }

  const result = await client.updateGroup(targetFarmId, validated.group_id, data);
  return {
    ...result,
    message: `Group ${validated.group_id} updated successfully`,
  };
}
