import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  description: z.string().optional(),
  farm_id: z.string().optional(),
  name: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const data: { description?: string; name: string } = { name: validated.name };
  if (validated.description) {
    data.description = validated.description;
  }

  const result = await client.createGroup(targetFarmId, data);
  return {
    ...result,
    message: `Group created successfully with ID: ${result.id}`,
  };
}
