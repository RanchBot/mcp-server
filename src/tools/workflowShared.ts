import { z } from 'zod';
import { RanchBotApiClient } from '../client';

import { workflowToolSchemas } from './_shared/workflowSchemas';
const farm = (explicit: string | undefined, fallback: string) =>
  z
    .string()
    .uuid()
    .parse(explicit || fallback);

export const listWorkflowTemplates = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const { farm_id, ...input } = workflowToolSchemas.list_workflow_templates.parse(args);
  return client.listWorkflowTemplates(farm(farm_id, farmId), input);
};

export const getWorkflowTemplate = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = workflowToolSchemas.get_workflow_template.parse(args);
  return client.getWorkflowTemplate(farm(input.farm_id, farmId), input.template_id);
};

export const createWorkflowTemplate = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = workflowToolSchemas.create_workflow_template.parse(args);
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
  const input = workflowToolSchemas.publish_workflow_template_version.parse(args);
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
  const input = workflowToolSchemas.update_workflow_template_state.parse(args);
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
  const input = workflowToolSchemas.set_default_workflow_template.parse(args);
  return client.setDefaultWorkflowTemplate(farm(input.farm_id, farmId), input.template_id, {
    expected_metadata_revision: input.expected_metadata_revision,
  });
};

export const previewWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const { farm_id, ...input } = workflowToolSchemas.preview_workflow.parse(args);
  return client.previewWorkflow(farm(farm_id, farmId), input);
};

export const getWorkflowPreview = async (
  client: RanchBotApiClient,
  farmId: string,
  args: unknown,
) => {
  const input = workflowToolSchemas.get_workflow_preview.parse(args);
  return client.getWorkflowPreview(farm(input.farm_id, farmId), input.preview_id);
};

export const commitWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const input = workflowToolSchemas.commit_workflow.parse(args);
  return client.commitWorkflow(farm(input.farm_id, farmId), input.preview_id, {
    approval: input.approval,
  });
};

export const discardWorkflow = async (client: RanchBotApiClient, farmId: string, args: unknown) => {
  const input = workflowToolSchemas.discard_workflow.parse(args);
  return client.discardWorkflow(farm(input.farm_id, farmId), input.preview_id);
};
