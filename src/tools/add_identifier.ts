import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  animal_id: z.string(),
  farm_id: z.string().optional(),
  is_primary: z.boolean().default(false),
  type: z.string(),
  value: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const result = await client.addAnimalIdentifier(targetFarmId, validated.animal_id, {
    is_primary: validated.is_primary,
    type: validated.type,
    value: validated.value,
  });
  return {
    ...result,
    message: `Identifier added to animal ${validated.animal_id}`,
  };
}
