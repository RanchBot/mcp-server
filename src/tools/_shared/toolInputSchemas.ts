import { z } from 'zod/v3';
import { setDefaultFarmSchema } from './inputSchemas';
import { paginatedToolSchemas } from './listSchemas';
import { workflowToolSchemas } from './workflowSchemas';

// Only the bounded surfaces hardened here; unrelated tool contracts are unchanged.
export const toolInputSchemas: Readonly<Record<string, z.AnyZodObject>> = Object.freeze({
  set_default_farm: setDefaultFarmSchema,
  ...paginatedToolSchemas,
  ...workflowToolSchemas,
});
