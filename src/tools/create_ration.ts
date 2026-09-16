import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  name: z.string().min(1),
  unit: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        per_head_lbs: z.coerce.number().positive(),
      }),
    )
    .min(1),
  assignments: z
    .array(
      z.object({
        group_id: z.string(),
        feedings_per_day: z.coerce.number().int().min(1).max(12).optional(),
        label: z.string().optional(),
      }),
    )
    .optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const ration = await client.createRation(targetFarmId, {
    name: validated.name,
    unit: validated.unit,
    ingredients: validated.ingredients,
    assignments: validated.assignments,
  });

  const assignmentNote =
    (ration.assignments?.length ?? 0) > 0
      ? ' Its group assignments are inactive until the user activates them on the Rations ' +
        'page in the app — remind them of that step.'
      : '';
  return {
    ration,
    message: `Created ration "${ration.name}" with ID: ${ration.id}.${assignmentNote}`,
  };
}
