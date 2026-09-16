import { z } from 'zod';
import { RanchBotApiClient } from '../client';
import { resolveGroupIdByName, widgetSchema } from './chuteSessionShared';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  name: z.string().optional(),
  widgets: z.array(widgetSchema).min(1),
  new_animal_fields: z.array(z.string()).optional(),
  record_type: z.string().optional(),
  group_name: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const groupId = await resolveGroupIdByName(client, targetFarmId, validated.group_name);

  const result = await client.createChuteSession(targetFarmId, {
    name: validated.name,
    config: {
      widgets: validated.widgets,
      new_animal_fields: validated.new_animal_fields,
      record_type: validated.record_type,
    },
    group_id: groupId,
  });

  return {
    ...result,
    message:
      `Proposed chute session "${result.name}" (${validated.widgets.length} widget(s)). ` +
      'The user reviews and starts it from Chute Mode in the app.',
  };
}
