/**
 * Animal-profile packing shared by the MCP create_animal / update_animal handlers. Mirrors the
 * chat-side packing in api/src/lib/services/intentHandlers.ts (packAnimalProfileFields) so the two
 * surfaces stay at parity: the described fields map to the canonical metadata keys the web reads
 * (web/src/lib/animalMeta.ts), and handlers merge them into `metadata`. The MCP server cannot
 * import across the api package boundary, so the key list is duplicated here deliberately.
 */

/** Canonical metadata keys for the described profile fields, in web read order. */
export const ANIMAL_PROFILE_FIELDS = [
  'name',
  'kind',
  'sex',
  'breed',
  'color',
  'birth_date',
  'notes',
] as const;

const trimToMetaValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Pack the described profile fields from a tool call into canonical metadata keys, dropping
 * blank/whitespace values so they never shadow real data. Returns the field-derived metadata
 * (empty when no profile fields were supplied); callers merge explicit `metadata` over it.
 */
export const packAnimalProfileFields = (args: Record<string, any>): Record<string, string> => {
  const fieldMetadata: Record<string, string> = {};
  for (const key of ANIMAL_PROFILE_FIELDS) {
    const trimmed = trimToMetaValue(args[key]);
    if (trimmed) fieldMetadata[key] = trimmed;
  }
  return fieldMetadata;
};
