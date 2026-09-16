import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({ farm_id: z.string().uuid().optional() });
const farm = (explicit: string | undefined, fallback: string) =>
  z
    .string()
    .uuid()
    .parse(explicit || fallback);
export const getBirthHistorySettings = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = argsSchema.strict().parse(args);
  return client.getBirthHistorySettings(farm(input.farm_id, farmId));
};
export const setBirthHistorySettings = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = argsSchema
    .extend({ settings: z.record(z.unknown()) })
    .strict()
    .parse(args);
  return client.setBirthHistorySettings(farm(input.farm_id, farmId), input.settings);
};
export const getBirthHistoryEvidence = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = argsSchema
    .extend({ dam_id: z.string().uuid(), birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .strict()
    .parse(args);
  return client.getBirthHistoryEvidence(farm(farm_id, farmId), input);
};
