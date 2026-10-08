import { paginatedToolSchemas } from './_shared/listSchemas';
import { RanchBotApiClient } from '../client';

const argsSchema = paginatedToolSchemas.list_chute_sessions;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { skip?: number; take?: number; status?: string } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }
  if (validated.status) {
    params.status = validated.status;
  }

  const result = await client.listChuteSessions(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} chute session(s)`,
  };
}
