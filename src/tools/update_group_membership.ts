import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  group_id: z.string(),
  add_animal_ids: z.array(z.string().uuid()).max(200).optional(),
  remove_animal_ids: z.array(z.string().uuid()).max(200).optional(),
  membership_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  farm_id: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  return client.updateGroupMembership(targetFarmId, validated.group_id, {
    ...(validated.add_animal_ids ? { add_animal_ids: validated.add_animal_ids } : {}),
    ...(validated.remove_animal_ids ? { remove_animal_ids: validated.remove_animal_ids } : {}),
    membership_fingerprint: validated.membership_fingerprint,
  });
}
