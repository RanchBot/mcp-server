import { z } from 'zod';
import { RanchBotApiClient } from '../client';
import { ANIMAL_PROFILE_FIELDS, packAnimalProfileFields } from './animalProfile';

// The described profile fields the model fills (the generated tool schema advertises these). The
// handler packs them into canonical metadata keys and merges any raw `metadata` over them.
const profileFieldSchema = Object.fromEntries(
  ANIMAL_PROFILE_FIELDS.map((key) => [key, z.string().optional()]),
);

const argsSchema = z.object({
  farm_id: z.string().optional(),
  inventory_status: z.enum(['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED']).optional(),
  ...profileFieldSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  // Pack the described profile fields into canonical metadata keys, merged with any explicit
  // metadata the caller passed (explicit metadata wins).
  const mergedMetadata = {
    ...packAnimalProfileFields(validated),
    ...(validated.metadata || {}),
  };

  const result = await client.createAnimal(targetFarmId, {
    inventory_status: validated.inventory_status,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
  });
  return {
    ...result,
    message: `Animal created successfully with ID: ${result.id}`,
  };
}
