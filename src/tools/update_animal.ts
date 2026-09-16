import { z } from 'zod';
import { RanchBotApiClient } from '../client';
import { ANIMAL_PROFILE_FIELDS, packAnimalProfileFields } from './animalProfile';

// The described profile fields the model fills (the generated tool schema advertises these). The
// handler packs them into canonical metadata keys and merges them into the animal's existing
// metadata rather than replacing it, so a one-field edit keeps the rest.
const profileFieldSchema = Object.fromEntries(
  ANIMAL_PROFILE_FIELDS.map((key) => [key, z.string().optional()]),
);

const argsSchema = z.object({
  animal_id: z.string(),
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

  const fieldMetadata = packAnimalProfileFields(validated);
  const hasMetadataUpdate =
    Object.keys(fieldMetadata).length > 0 || validated.metadata !== undefined;

  // Merge into the EXISTING metadata (not replace): fetch the current animal first so keys that
  // are not being changed are preserved. Explicit `metadata` wins over the named fields; both win
  // over the prior values. When nothing was supplied, leave metadata untouched (a no-op update).
  let mergedMetadata: Record<string, any> | undefined;
  if (hasMetadataUpdate) {
    const existing = await client.getAnimal(targetFarmId, validated.animal_id);
    mergedMetadata = {
      ...((existing?.metadata as Record<string, any> | null | undefined) || {}),
      ...fieldMetadata,
      ...(validated.metadata || {}),
    };
  }

  const result = await client.updateAnimal(targetFarmId, validated.animal_id, {
    inventory_status: validated.inventory_status,
    metadata: mergedMetadata,
  });
  return {
    ...result,
    message: `Animal ${validated.animal_id} updated successfully`,
  };
}
