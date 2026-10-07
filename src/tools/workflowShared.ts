import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const farmField = { farm_id: z.string().uuid().optional() };
const pageSchema = z.object({
  ...farmField,
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(200).optional(),
  workflow: z.string().max(80).optional(),
});
const farm = (explicit: string | undefined, fallback: string) =>
  z
    .string()
    .uuid()
    .parse(explicit || fallback);
const definition = z.record(z.unknown());
const previewSchema = z.object({
  ...farmField,
  request_id: z.string().uuid(),
  template_id: z.string().uuid(),
  template_version: z.number().int().positive().optional(),
  inputs: z
    .object({
      event: z.record(z.unknown()).optional(),
      offspring: z.array(z.record(z.unknown())).optional(),
    })
    .strict(),
  timezone: z.string().min(1).max(100).optional(),
  replaces_preview_id: z.string().uuid().optional(),
});

export const listWorkflowTemplates = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = pageSchema.strict().parse(args);
  return client.listWorkflowTemplates(farm(farm_id, farmId), input);
};

export const getWorkflowTemplate = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({ ...farmField, template_id: z.string().uuid() })
    .strict()
    .parse(args);
  return client.getWorkflowTemplate(farm(input.farm_id, farmId), input.template_id);
};

export const createWorkflowTemplate = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({ ...farmField, definition, is_default: z.boolean().optional() })
    .strict()
    .parse(args);
  return client.createWorkflowTemplate(farm(input.farm_id, farmId), {
    definition: input.definition,
    ...(input.is_default === undefined ? {} : { is_default: input.is_default }),
  });
};

export const publishWorkflowTemplateVersion = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({
      ...farmField,
      template_id: z.string().uuid(),
      expected_current_version: z.number().int().min(0),
      definition,
    })
    .strict()
    .parse(args);
  return client.publishWorkflowTemplateVersion(farm(input.farm_id, farmId), input.template_id, {
    expected_current_version: input.expected_current_version,
    definition: input.definition,
  });
};

export const updateWorkflowTemplateState = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({
      ...farmField,
      template_id: z.string().uuid(),
      expected_metadata_revision: z.number().int().min(0),
      is_active: z.boolean(),
      replacement_template_id: z.string().uuid().optional(),
    })
    .strict()
    .parse(args);
  return client.updateWorkflowTemplateState(farm(input.farm_id, farmId), input.template_id, {
    expected_metadata_revision: input.expected_metadata_revision,
    is_active: input.is_active,
    ...(input.replacement_template_id
      ? { replacement_template_id: input.replacement_template_id }
      : {}),
  });
};

export const setDefaultWorkflowTemplate = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({
      ...farmField,
      template_id: z.string().uuid(),
      expected_metadata_revision: z.number().int().min(0),
    })
    .strict()
    .parse(args);
  return client.setDefaultWorkflowTemplate(farm(input.farm_id, farmId), input.template_id, {
    expected_metadata_revision: input.expected_metadata_revision,
  });
};

export const previewWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const { farm_id, ...input } = previewSchema.strict().parse(args);
  return client.previewWorkflow(farm(farm_id, farmId), input);
};

export const getWorkflowPreview = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = z
    .object({ ...farmField, preview_id: z.string().uuid() })
    .strict()
    .parse(args);
  return client.getWorkflowPreview(farm(input.farm_id, farmId), input.preview_id);
};

export const commitWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const input = z
    .object({
      ...farmField,
      preview_id: z.string().uuid(),
      approval: z
        .object({
          confirmed: z.literal(true),
          preview_hash: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    })
    .strict()
    .parse(args);
  return client.commitWorkflow(farm(input.farm_id, farmId), input.preview_id, {
    approval: input.approval,
  });
};

export const discardWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const input = z
    .object({ ...farmField, preview_id: z.string().uuid() })
    .strict()
    .parse(args);
  return client.discardWorkflow(farm(input.farm_id, farmId), input.preview_id);
};
