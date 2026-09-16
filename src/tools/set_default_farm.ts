import { z } from 'zod';

const argsSchema = z.object({
  farm_id: z.string().optional(),
});

// Persistence is the transport's job: serverFactory calls deps.persistDefaultFarm
// (DB on the hosted http path, in-memory on stdio) before dispatching here, so
// this handler only shapes the response — it must not touch the module-level
// default-farm global (dead on the stateless http path; a multi-tenant hazard).
export async function handleTool(client: any, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  return {
    default_farm_id: targetFarmId,
    message: `Default farm set to ${targetFarmId}`,
  };
}
