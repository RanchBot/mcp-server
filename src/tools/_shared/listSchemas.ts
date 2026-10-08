import { z } from 'zod/v3';
import { paginationFields } from './inputSchemas';

const page = z.object({ farm_id: z.string().optional(), ...paginationFields }).strict();
const uuidPage = z.object({ farm_id: z.string().uuid().optional(), ...paginationFields }).strict();

export const paginatedToolSchemas = {
  list_animals: page.extend({
    inventory_status: z.enum(['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED', 'ALL']).optional(),
  }),
  list_records: page.extend({ type: z.string().optional() }),
  list_feedings: page.extend({
    status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
    since: z.string().optional(),
  }),
  list_rations: page.extend({ include_inactive: z.boolean().optional() }),
  list_chute_sessions: page.extend({
    status: z.enum(['PROPOSED', 'ACTIVE', 'COMPLETED']).optional(),
  }),
  list_pending_imports: z
    .object({
      ...paginationFields,
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    })
    .strict(),
  list_birth_events: uuidPage.extend({ animal_id: z.string().uuid().optional() }),
  list_farm_tasks: uuidPage.extend({ status: z.enum(['TODO', 'DONE', 'CANCELLED']).optional() }),
  list_protocol_versions: uuidPage,
  list_workflow_templates: uuidPage.extend({ workflow: z.string().max(80).optional() }),
};
