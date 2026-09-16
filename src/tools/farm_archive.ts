import { z } from 'zod';
import { RanchBotApiClient } from '../client';
const schema = z.object({
  farm_id: z.string().uuid().optional(),
  operation: z.enum(['create', 'list', 'status', 'cancel', 'download']),
  export_id: z.string().uuid().optional(),
  output_path: z.string().min(1).optional(),
});
export async function handleTool(client: RanchBotApiClient, farmId: string, args: unknown) {
  const input = schema.parse(args);
  const farm = z
    .string()
    .uuid()
    .parse(input.farm_id || farmId);
  if (input.operation === 'create') return client.requestFarmExport(farm);
  if (input.operation === 'list') return client.listFarmExports(farm);
  const id = z.string().uuid().parse(input.export_id);
  if (input.operation === 'status') return client.farmExportStatus(farm, id);
  if (input.operation === 'cancel') return client.cancelFarmExport(farm, id);
  return client.downloadFarmExport(farm, id, z.string().min(1).parse(input.output_path));
}
