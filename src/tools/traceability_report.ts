import { RanchBotApiClient } from '../client';
import { traceabilityReportSchema } from './_shared/listSchemas';

const argsSchema = traceabilityReportSchema;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, ...params } = validated;
  return client.getTraceabilityReport(targetFarmId, params);
}
