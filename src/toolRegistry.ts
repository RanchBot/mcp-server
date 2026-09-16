/**
 * Tool registry for mapping tool names to their handler modules
 * This centralizes tool routing and makes it easier to maintain
 */

export const toolRegistry: Record<string, string> = {
  get_birth_history_settings: './tools/get_birth_history_settings.js',
  set_birth_history_settings: './tools/set_birth_history_settings.js',
  get_birth_history_evidence: './tools/get_birth_history_evidence.js',
  farm_archive: './tools/farm_archive.js',
  preview_birth_event: './tools/preview_birth_event.js',
  confirm_birth_event: './tools/confirm_birth_event.js',
  list_birth_events: './tools/list_birth_events.js',
  get_birth_event: './tools/get_birth_event.js',
  get_birth_source_evidence: './tools/get_birth_source_evidence.js',
  list_farm_tasks: './tools/list_farm_tasks.js',
  update_farm_task: './tools/update_farm_task.js',
  list_protocol_versions: './tools/list_protocol_versions.js',
  create_protocol_version: './tools/create_protocol_version.js',
  // Farm tools
  list_my_farms: './tools/list_my_farms.js',
  get_farm: './tools/get_farm.js',
  set_default_farm: './tools/set_default_farm.js',
  get_current_context: './tools/get_current_context.js',

  // Animal tools
  list_animals: './tools/list_animals.js',
  get_animal: './tools/get_animal.js',
  create_animal: './tools/create_animal.js',
  update_animal: './tools/update_animal.js',
  delete_animal: './tools/delete_animal.js',
  find_animal_by_identifier: './tools/find_animal_by_identifier.js',

  // Identifier tools
  list_identifiers: './tools/list_identifiers.js',
  add_identifier: './tools/add_identifier.js',
  remove_identifier: './tools/remove_identifier.js',

  // Group tools
  list_groups: './tools/list_groups.js',
  get_group: './tools/get_group.js',
  create_group: './tools/create_group.js',
  update_group: './tools/update_group.js',
  delete_group: './tools/delete_group.js',
  restore_group: './tools/restore_group.js',

  // Chute session tools
  list_chute_sessions: './tools/list_chute_sessions.js',
  get_chute_session: './tools/get_chute_session.js',
  create_chute_session: './tools/create_chute_session.js',
  update_chute_session: './tools/update_chute_session.js',

  // Concierge import tools (admin only)
  list_pending_imports: './tools/list_pending_imports.js',
  get_import_request: './tools/get_import_request.js',
  update_import_request_status: './tools/update_import_request_status.js',

  // Memory tools — read-only on purpose: save_memory is chat-only so every memory write
  // stays behind the in-app visibility contract (chip + memory page).
  list_memories: './tools/list_memories.js',

  // Ration / feeding tools
  list_rations: './tools/list_rations.js',
  get_ration: './tools/get_ration.js',
  create_ration: './tools/create_ration.js',
  list_feedings: './tools/list_feedings.js',
  get_feeding: './tools/get_feeding.js',

  // Record tools
  list_records: './tools/list_records.js',
  get_record: './tools/get_record.js',
  create_record: './tools/create_record.js',
  update_record: './tools/update_record.js',
  delete_record: './tools/delete_record.js',
};

/**
 * Get the handler module path for a tool
 */
export function getToolHandlerPath(toolName: string): string | undefined {
  return toolRegistry[toolName];
}
