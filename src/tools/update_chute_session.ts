import { z } from 'zod';
import { RanchBotApiClient } from '../client';
import { resolveGroupIdByName, widgetSchema } from './chuteSessionShared';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  session_id: z.string(),
  name: z.string().optional(),
  widgets: z.array(widgetSchema).min(1).optional(),
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

  const result = await client.updateChuteSession(targetFarmId, validated.session_id, {
    name: validated.name,
    config: validated.widgets
      ? { widgets: validated.widgets, record_type: validated.record_type }
      : undefined,
    group_id: groupId,
  });

  return {
    ...result,
    message: `Updated proposed chute session "${result.name}".`,
  };
}
