import { z } from 'zod/v3';
import { paginationFields } from './inputSchemas';

export const TRACEABILITY_EVENT_KINDS = [
  'MOVEMENT',
  'PURCHASE',
  'SALE',
  'IMPORT',
  'EXPORT',
  'DEATH',
  'SLAUGHTER',
  'DISPOSAL',
  'IDENTIFICATION',
] as const;

const traceabilityKind = z.enum(TRACEABILITY_EVENT_KINDS);

/** Scheduled/typed report page size: 1-100, never the export cap. */
export const reportPageFields = {
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
};

const page = z.object({ farm_id: z.string().optional(), ...paginationFields }).strict();
const uuidPage = z.object({ farm_id: z.string().uuid().optional(), ...paginationFields }).strict();

export const paginatedToolSchemas = {
  list_animals: page.extend({
    inventory_status: z
      .enum(['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED', 'NOT_MANAGED', 'ALL'])
      .optional(),
    query: z.string().optional(),
    match_mode: z.enum(['exact', 'partial']).optional(),
    identifier_type: z.enum(['BRAND', 'EID', 'MANAGEMENT_TAG', 'NAME', 'TATTOO']).optional(),
  }),
  list_records: page.extend({
    type: z.string().optional(),
    animal_id: z.string().uuid().optional(),
    group_id: z.string().uuid().optional(),
    include_group_context: z.boolean().optional(),
    applied_from: z.string().optional(),
    applied_before: z.string().optional(),
  }),
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
  list_traceability_events: page.extend({
    kind: traceabilityKind.optional(),
    movement: z.boolean().optional(),
    include_void: z.boolean().optional(),
  }),
};

/**
 * The completeness report paginates typed events the same way list reads do, but the page size is
 * capped at 100 (the CSV export cap is internal and deliberately not advertisable). `from`/`to`
 * are validated as calendar dates by the API service.
 */
export const traceabilityReportSchema = z
  .object({
    farm_id: z.string().optional(),
    kind: traceabilityKind.optional(),
    movement: z.boolean().optional(),
    date_basis: z.enum(['effective', 'departure', 'arrival']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    animal_id: z.string().uuid().optional(),
    identifier: z.string().max(128).optional(),
    location_id: z.string().uuid().optional(),
    include_void: z.boolean().optional(),
    include_legacy: z.boolean().optional(),
    ...reportPageFields,
  })
  .strict();

/**
 * Transport suggestions are a bounded top-N read, not an offset page: they accept no `skip` and
 * cap `take` at 100, matching the HTTP contract and the hosted MCP catalog.
 */
export const recentTransportSuggestionsSchema = z
  .object({ farm_id: z.string().optional(), take: z.number().int().min(1).max(100).optional() })
  .strict();
