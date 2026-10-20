import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  description: z.string().optional(),
  farm_id: z.string().optional(),
  group_id: z.string(),
  name: z.string().optional(),
  animal_ids: z.array(z.string().uuid()).optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const data: { description?: string; name?: string; animal_ids?: string[] } = {};
  if (validated.name !== undefined) {
    data.name = validated.name;
  }
  if (validated.description !== undefined) {
    data.description = validated.description;
  }
  if (validated.animal_ids !== undefined) {
    data.animal_ids = validated.animal_ids;
  }

  const result = await client.updateGroup(targetFarmId, validated.group_id, data);
  return {
    ...result,
    message:
      (validated.animal_ids?.length ?? 0) > 0
        ? `Ensured the requested animals belong to group ${validated.group_id}`
        : `Group ${validated.group_id} updated successfully`,
  };
}
