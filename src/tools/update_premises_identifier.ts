import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string().uuid(),
  identifier_id: z.string().uuid(),
  scheme: z.enum(['CA_PID', 'US_PIN', 'US_LID', 'OTHER']).optional(),
  scheme_label: z.string().max(100).nullable().optional(),
  issuer: z.string().max(200).nullable().optional(),
  jurisdiction: z.string().max(100).nullable().optional(),
  value: z.string().min(1).max(128).optional(),
  source: z.string().max(200).nullable().optional(),
  confirmed: z.boolean().optional(),
  is_preferred: z.boolean().optional(),
  expected_version: z.number().int().nonnegative().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, location_id, identifier_id, ...data } = validated;
  const result = await client.updatePremisesIdentifier(
    targetFarmId,
    location_id,
    identifier_id,
    data as any,
  );
  return { ...result, message: `Premises identifier ${identifier_id} updated` };
}
