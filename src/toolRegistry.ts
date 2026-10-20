/**
 * Static tool registry.
 *
 * Every tool name maps to a handler function imported through an explicit
 * literal module specifier. There is deliberately no path-based lookup and no
 * runtime module selection: a caller can only ever dispatch to a handler that
 * was linked in at startup.
 */

import type { RanchBotApiClient } from './client';
import { handleTool as getBirthHistorySettings } from './tools/get_birth_history_settings';
import { handleTool as setBirthHistorySettings } from './tools/set_birth_history_settings';
import { handleTool as getBirthHistoryEvidence } from './tools/get_birth_history_evidence';
import { handleTool as farmArchive } from './tools/farm_archive';
import { handleTool as previewBirthEvent } from './tools/preview_birth_event';
import { handleTool as confirmBirthEvent } from './tools/confirm_birth_event';
import { handleTool as listBirthEvents } from './tools/list_birth_events';
import { handleTool as getBirthEvent } from './tools/get_birth_event';
import { handleTool as getBirthSourceEvidence } from './tools/get_birth_source_evidence';
import { handleTool as listFarmTasks } from './tools/list_farm_tasks';
import { handleTool as updateFarmTask } from './tools/update_farm_task';
import { handleTool as listProtocolVersions } from './tools/list_protocol_versions';
import { handleTool as createProtocolVersion } from './tools/create_protocol_version';
import { handleTool as listWorkflowTemplates } from './tools/list_workflow_templates';
import { handleTool as getWorkflowTemplate } from './tools/get_workflow_template';
import { handleTool as createWorkflowTemplate } from './tools/create_workflow_template';
import { handleTool as publishWorkflowTemplateVersion } from './tools/publish_workflow_template_version';
import { handleTool as updateWorkflowTemplateState } from './tools/update_workflow_template_state';
import { handleTool as setDefaultWorkflowTemplate } from './tools/set_default_workflow_template';
import { handleTool as previewWorkflow } from './tools/preview_workflow';
import { handleTool as getWorkflowPreview } from './tools/get_workflow_preview';
import { handleTool as commitWorkflow } from './tools/commit_workflow';
import { handleTool as discardWorkflow } from './tools/discard_workflow';
import { handleTool as listMyFarms } from './tools/list_my_farms';
import { handleTool as getFarm } from './tools/get_farm';
import { handleTool as setDefaultFarm } from './tools/set_default_farm';
import { handleTool as getCurrentContext } from './tools/get_current_context';
import { handleTool as listAnimals } from './tools/list_animals';
import { handleTool as getAnimal } from './tools/get_animal';
import { handleTool as createAnimal } from './tools/create_animal';
import { handleTool as updateAnimal } from './tools/update_animal';
import { handleTool as deleteAnimal } from './tools/delete_animal';
import { handleTool as lookupAnimalByEid } from './tools/lookup_animal_by_eid';
import { handleTool as findOrCreateAnimalByEid } from './tools/find_or_create_animal_by_eid';
import { handleTool as findAnimalByIdentifier } from './tools/find_animal_by_identifier';
import { handleTool as listIdentifiers } from './tools/list_identifiers';
import { handleTool as addIdentifier } from './tools/add_identifier';
import { handleTool as removeIdentifier } from './tools/remove_identifier';
import { handleTool as listGroups } from './tools/list_groups';
import { handleTool as getGroup } from './tools/get_group';
import { handleTool as createGroup } from './tools/create_group';
import { handleTool as updateGroup } from './tools/update_group';
import { handleTool as updateGroupMembership } from './tools/update_group_membership';
import { handleTool as deleteGroup } from './tools/delete_group';
import { handleTool as restoreGroup } from './tools/restore_group';
import { handleTool as listChuteSessions } from './tools/list_chute_sessions';
import { handleTool as getChuteSession } from './tools/get_chute_session';
import { handleTool as createChuteSession } from './tools/create_chute_session';
import { handleTool as updateChuteSession } from './tools/update_chute_session';
import { handleTool as listPendingImports } from './tools/list_pending_imports';
import { handleTool as getImportRequest } from './tools/get_import_request';
import { handleTool as updateImportRequestStatus } from './tools/update_import_request_status';
import { handleTool as listMemories } from './tools/list_memories';
import { handleTool as listRations } from './tools/list_rations';
import { handleTool as getRation } from './tools/get_ration';
import { handleTool as createRation } from './tools/create_ration';
import { handleTool as listFeedings } from './tools/list_feedings';
import { handleTool as getFeeding } from './tools/get_feeding';
import { handleTool as listRecords } from './tools/list_records';
import { handleTool as getRecord } from './tools/get_record';
import { handleTool as createRecord } from './tools/create_record';
import { handleTool as updateRecord } from './tools/update_record';
import { handleTool as deleteRecord } from './tools/delete_record';
import { handleTool as listLocations } from './tools/list_locations';
import { handleTool as getLocation } from './tools/get_location';
import { handleTool as createLocation } from './tools/create_location';
import { handleTool as updateLocation } from './tools/update_location';
import { handleTool as archiveLocation } from './tools/archive_location';
import { handleTool as restoreLocation } from './tools/restore_location';
import { handleTool as setHomeLocation } from './tools/set_home_location';
import { handleTool as addPremisesIdentifier } from './tools/add_premises_identifier';
import { handleTool as updatePremisesIdentifier } from './tools/update_premises_identifier';
import { handleTool as deletePremisesIdentifier } from './tools/delete_premises_identifier';
import { handleTool as createTraceabilityEvent } from './tools/create_traceability_event';
import { handleTool as listTraceabilityEvents } from './tools/list_traceability_events';
import { handleTool as getTraceabilityEvent } from './tools/get_traceability_event';
import { handleTool as getTraceabilityEventRevisions } from './tools/get_traceability_event_revisions';
import { handleTool as correctTraceabilityEvent } from './tools/correct_traceability_event';
import { handleTool as voidTraceabilityEvent } from './tools/void_traceability_event';
import { handleTool as findIdentifierHistory } from './tools/find_identifier_history';
import { handleTool as recentTransportSuggestions } from './tools/recent_transport_suggestions';
import { handleTool as traceabilityReport } from './tools/traceability_report';

/** Signature shared by every per-tool handler. */
export type ToolHandler = (
  client: RanchBotApiClient,
  farmId: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Tool name → handler function. Frozen: the mapping cannot be mutated at runtime.
 */
export const toolRegistry: Readonly<Record<string, ToolHandler>> = Object.freeze({
  get_birth_history_settings: getBirthHistorySettings,
  set_birth_history_settings: setBirthHistorySettings,
  get_birth_history_evidence: getBirthHistoryEvidence,
  farm_archive: farmArchive,
  preview_birth_event: previewBirthEvent,
  confirm_birth_event: confirmBirthEvent,
  list_birth_events: listBirthEvents,
  get_birth_event: getBirthEvent,
  get_birth_source_evidence: getBirthSourceEvidence,
  list_farm_tasks: listFarmTasks,
  update_farm_task: updateFarmTask,
  list_protocol_versions: listProtocolVersions,
  create_protocol_version: createProtocolVersion,
  // Workflow template and preview/commit tools
  list_workflow_templates: listWorkflowTemplates,
  get_workflow_template: getWorkflowTemplate,
  create_workflow_template: createWorkflowTemplate,
  publish_workflow_template_version: publishWorkflowTemplateVersion,
  update_workflow_template_state: updateWorkflowTemplateState,
  set_default_workflow_template: setDefaultWorkflowTemplate,
  preview_workflow: previewWorkflow,
  get_workflow_preview: getWorkflowPreview,
  commit_workflow: commitWorkflow,
  discard_workflow: discardWorkflow,
  // Farm tools
  list_my_farms: listMyFarms,
  get_farm: getFarm,
  set_default_farm: setDefaultFarm,
  get_current_context: getCurrentContext,

  // Animal tools
  list_animals: listAnimals,
  get_animal: getAnimal,
  create_animal: createAnimal,
  update_animal: updateAnimal,
  delete_animal: deleteAnimal,
  lookup_animal_by_eid: lookupAnimalByEid,
  find_or_create_animal_by_eid: findOrCreateAnimalByEid,
  find_animal_by_identifier: findAnimalByIdentifier,

  // Identifier tools
  list_identifiers: listIdentifiers,
  add_identifier: addIdentifier,
  remove_identifier: removeIdentifier,

  // Group tools
  list_groups: listGroups,
  get_group: getGroup,
  create_group: createGroup,
  update_group: updateGroup,
  update_group_membership: updateGroupMembership,
  delete_group: deleteGroup,
  restore_group: restoreGroup,

  // Chute session tools
  list_chute_sessions: listChuteSessions,
  get_chute_session: getChuteSession,
  create_chute_session: createChuteSession,
  update_chute_session: updateChuteSession,

  // Concierge import tools (admin only)
  list_pending_imports: listPendingImports,
  get_import_request: getImportRequest,
  update_import_request_status: updateImportRequestStatus,

  // Memory tools — read-only on purpose: save_memory is chat-only so every memory write
  // stays behind the in-app visibility contract (chip + memory page).
  list_memories: listMemories,

  // Ration / feeding tools
  list_rations: listRations,
  get_ration: getRation,
  create_ration: createRation,
  list_feedings: listFeedings,
  get_feeding: getFeeding,

  // Record tools
  list_records: listRecords,
  get_record: getRecord,
  create_record: createRecord,
  update_record: updateRecord,
  delete_record: deleteRecord,

  // Location / premises tools (#381)
  list_locations: listLocations,
  get_location: getLocation,
  create_location: createLocation,
  update_location: updateLocation,
  archive_location: archiveLocation,
  restore_location: restoreLocation,
  set_home_location: setHomeLocation,
  add_premises_identifier: addPremisesIdentifier,
  update_premises_identifier: updatePremisesIdentifier,
  delete_premises_identifier: deletePremisesIdentifier,

  // Typed traceability tools (#381)
  create_traceability_event: createTraceabilityEvent,
  list_traceability_events: listTraceabilityEvents,
  get_traceability_event: getTraceabilityEvent,
  get_traceability_event_revisions: getTraceabilityEventRevisions,
  correct_traceability_event: correctTraceabilityEvent,
  void_traceability_event: voidTraceabilityEvent,
  find_identifier_history: findIdentifierHistory,
  recent_transport_suggestions: recentTransportSuggestions,
  traceability_report: traceabilityReport,
});

/**
 * Get the handler for a tool. Uses an own-property check so inherited names
 * (`constructor`, `toString`, `__proto__`, …) never resolve.
 */
export function getToolHandler(toolName: string): ToolHandler | undefined {
  return Object.prototype.hasOwnProperty.call(toolRegistry, toolName)
    ? toolRegistry[toolName]
    : undefined;
}
