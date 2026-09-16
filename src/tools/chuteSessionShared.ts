import { z } from 'zod';
import { RanchBotApiClient } from '../client';

/** Widget shape mirroring api/src/lib/chuteConfig.ts (the API re-validates strictly). */
export const widgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['boolean', 'number', 'photo', 'score', 'select', 'text', 'treatment', 'weight']),
  label: z.string().min(1),
  size: z.enum(['full', 'half']).optional(),
  options: z.record(z.any()).optional(),
});

/** Resolve a group by name (case-insensitive), creating it when missing. */
export async function resolveGroupIdByName(
  client: RanchBotApiClient,
  farmId: string,
  groupName: string | undefined,
): Promise<string | undefined> {
  if (!groupName?.trim()) return undefined;
  const name = groupName.trim();

  const groups = await client.listGroups(farmId);
  const existing = (groups.records ?? []).find(
    (group: { id: string; name: string }) => group.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;

  const created = await client.createGroup(farmId, { name });
  return created.id;
}
