import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const farmField = { farm_id: z.string().uuid().optional() };
const pageSchema = z.object({
  ...farmField,
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(200).optional(),
});
const requestSchema = z.object({
  ...farmField,
  request_id: z.string().uuid(),
  bundle: z.record(z.unknown()),
});
const taskStatus = z.enum(['TODO', 'DONE', 'CANCELLED']);
const farm = (explicit: string | undefined, fallback: string) =>
  z
    .string()
    .uuid()
    .parse(explicit || fallback);

export const previewBirthEvent = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = requestSchema.strict().parse(args);
  return client.previewBirthEvent(farm(farm_id, farmId), input);
};

export const confirmBirthEvent = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = requestSchema
    .extend({ confirmation_hash: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .parse(args);
  return client.confirmBirthEvent(farm(farm_id, farmId), input);
};

export const listBirthEvents = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const { farm_id, ...input } = pageSchema
    .extend({ animal_id: z.string().uuid().optional() })
    .strict()
    .parse(args);
  return client.listBirthEvents(farm(farm_id, farmId), input);
};

export const getBirthEvent = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const input = z
    .object({ ...farmField, event_id: z.string().uuid() })
    .strict()
    .parse(args);
  return client.getBirthEvent(farm(input.farm_id, farmId), input.event_id);
};

export const getBirthSourceEvidence = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({ ...farmField, source_sms_id: z.string().uuid() })
    .strict()
    .parse(args);
  return client.getBirthSourceEvidence(farm(input.farm_id, farmId), input.source_sms_id);
};

export const listFarmTasks = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const { farm_id, ...input } = pageSchema
    .extend({ status: taskStatus.optional() })
    .strict()
    .parse(args);
  return client.listFarmTasks(farm(farm_id, farmId), input);
};

export const updateFarmTask = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const { farm_id, task_id, ...input } = z
    .object({
      ...farmField,
      task_id: z.string().uuid(),
      status: taskStatus,
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    })
    .strict()
    .parse(args);
  return client.updateFarmTask(farm(farm_id, farmId), task_id, input);
};

export const listProtocolVersions = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = pageSchema.strict().parse(args);
  return client.listProtocolVersions(farm(farm_id, farmId), input);
};

export const createProtocolVersion = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = z
    .object({
      ...farmField,
      name: z.string().trim().min(1).max(80),
      version: z.string().trim().min(1).max(80),
      steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(40),
    })
    .strict()
    .parse(args);
  return client.createProtocolVersion(farm(farm_id, farmId), input);
};
