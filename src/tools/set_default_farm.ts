import { setDefaultFarmSchema } from './_shared/inputSchemas';

// Persistence is transport-owned; the factory validates this same schema before writing.
export async function handleTool(_client: any, _farmId: string, args: unknown) {
  const { farm_id } = setDefaultFarmSchema.parse(args);
  return {
    default_farm_id: farm_id,
    message: `Default farm set to ${farm_id}`,
  };
}
