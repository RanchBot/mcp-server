import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const toInputSchema = (schema: z.AnyZodObject): Tool['inputSchema'] =>
  zodToJsonSchema(schema, { $refStrategy: 'none' }) as Tool['inputSchema'];

export const setDefaultFarmSchema = z
  .object({ farm_id: z.string().uuid().describe('The ID of the farm to set as default') })
  .strict();

export const paginationFields = {
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(200).optional(),
};
