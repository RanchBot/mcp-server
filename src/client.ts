import { createWriteStream } from 'fs';
import { rm } from 'fs/promises';
import { createHash } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import axios, { AxiosInstance } from 'axios';
import { RANCHBOT_API_URL, API_VERSION } from './config';

export type AnimalInventoryStatus = 'CURRENT' | 'UNKNOWN' | 'SOLD' | 'DECEASED';

export interface ApiClientOptions {
  accessToken: string;
}

/**
 * API client for Ranch.Bot API
 */
export class RanchBotApiClient {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(options: ApiClientOptions) {
    this.accessToken = options.accessToken;
    this.client = axios.create({
      ...(options.accessToken.startsWith('rb_local_')
        ? { maxRedirects: 0, proxy: false as const }
        : {}),
      baseURL: `${RANCHBOT_API_URL}/api/${API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  /**
   * Get all farms for the authenticated user
   */
  async getBirthHistorySettings(farmId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-history/settings`)).data;
  }

  async setBirthHistorySettings(farmId: string, settings: Record<string, unknown>) {
    return (await this.client.put(`/farm/${farmId}/birth-history/settings`, settings)).data;
  }

  async getBirthHistoryEvidence(farmId: string, params: { dam_id: string; birth_date: string }) {
    return (await this.client.get(`/farm/${farmId}/birth-history/evidence`, { params })).data;
  }

  async previewBirthEvent(
    farmId: string,
    data: { request_id: string; bundle: Record<string, unknown> },
  ) {
    return (await this.client.post(`/farm/${farmId}/birth-events/preview`, data)).data;
  }

  async confirmBirthEvent(
    farmId: string,
    data: { request_id: string; bundle: Record<string, unknown>; confirmation_hash: string },
  ) {
    return (await this.client.post(`/farm/${farmId}/birth-events`, data)).data;
  }

  async listBirthEvents(
    farmId: string,
    params?: { skip?: number; take?: number; animal_id?: string },
  ) {
    return (await this.client.get(`/farm/${farmId}/birth-events`, { params })).data;
  }

  async getBirthEvent(farmId: string, eventId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-events/${eventId}`)).data;
  }

  async getBirthSourceEvidence(farmId: string, sourceSmsId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-sources/${sourceSmsId}`)).data;
  }

  async listFarmTasks(farmId: string, params?: { skip?: number; take?: number; status?: string }) {
    return (await this.client.get(`/farm/${farmId}/farm-tasks`, { params })).data;
  }

  async updateFarmTask(
    farmId: string,
    taskId: string,
    data: { status: 'TODO' | 'DONE' | 'CANCELLED'; due_date?: string | null },
  ) {
    return (await this.client.put(`/farm/${farmId}/farm-tasks/${taskId}`, data)).data;
  }

  async listProtocolVersions(farmId: string, params?: { skip?: number; take?: number }) {
    return (await this.client.get(`/farm/${farmId}/protocol-versions`, { params })).data;
  }

  async createProtocolVersion(
    farmId: string,
    data: { name: string; version: string; steps: string[] },
  ) {
    return (await this.client.post(`/farm/${farmId}/protocol-versions`, data)).data;
  }

  async requestFarmExport(farmId: string) {
    return (await this.client.post(`/farm/${farmId}/exports`)).data;
  }

  async listFarmExports(farmId: string) {
    return (await this.client.get(`/farm/${farmId}/exports`)).data;
  }

  async farmExportStatus(farmId: string, id: string) {
    return (await this.client.get(`/farm/${farmId}/exports/${id}`)).data;
  }

  async cancelFarmExport(farmId: string, id: string) {
    return (await this.client.delete(`/farm/${farmId}/exports/${id}`)).data;
  }

  async downloadFarmExport(farmId: string, id: string, destination: string) {
    const response = await this.client.get(`/farm/${farmId}/exports/${id}/download`, {
      responseType: 'stream',
      maxRedirects: 0,
    });
    const hash = createHash('sha256');
    const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
    let created = false;
    output.once('open', () => {
      created = true;
    });
    try {
      await pipeline(
        response.data,
        new Transform({
          transform(chunk, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        output,
      );
      const checksum = hash.digest('hex');
      if (checksum !== response.headers['x-content-sha256'])
        throw new Error('Archive checksum does not match. Download again.');
      return { path: destination, sha256: checksum };
    } catch (error) {
      if (created) await rm(destination, { force: true });
      throw error;
    }
  }

  async getFarms() {
    const response = await this.client.get('/farm');
    // API returns { total, records }, but we'll return { farms: records } for consistency
    return {
      farms: response.data.records || [],
      total: response.data.total || 0,
    };
  }

  /**
   * Get a specific farm
   */
  async getFarm(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}`);
    return response.data;
  }

  /**
   * Get the default farm bound to this API key (null if unset). Used by the
   * stateless HTTP transport to resolve a default farm.
   */
  async getDefaultFarm(): Promise<string | null> {
    const response = await this.client.get('/user/default-farm');
    return response.data.default_farm_id ?? null;
  }

  /**
   * Bind (or clear, with null) the default farm on this API key.
   */
  async setDefaultFarm(farmId: string | null): Promise<void> {
    await this.client.put('/user/default-farm', { farm_id: farmId });
  }

  /**
   * List animals in a farm
   */
  async listAnimals(
    farmId: string,
    params?: { skip?: number; take?: number; inventory_status?: AnimalInventoryStatus | 'ALL' },
  ) {
    const response = await this.client.get(`/farm/${farmId}/animals`, {
      params,
    });
    return response.data;
  }

  /**
   * Get a specific animal
   */
  async getAnimal(farmId: string, animalId: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/${animalId}`);
    return response.data;
  }

  /**
   * Create an animal
   */
  async createAnimal(
    farmId: string,
    data: { metadata?: any; inventory_status?: AnimalInventoryStatus },
  ) {
    const response = await this.client.post(`/farm/${farmId}/animals`, data);
    return response.data;
  }

  /**
   * Update an animal
   */
  async updateAnimal(
    farmId: string,
    animalId: string,
    data: { metadata?: any; inventory_status?: AnimalInventoryStatus },
  ) {
    const response = await this.client.put(`/farm/${farmId}/animals/${animalId}`, data);
    return response.data;
  }

  /**
   * Delete an animal
   */
  async deleteAnimal(farmId: string, animalId: string) {
    await this.client.delete(`/farm/${farmId}/animals/${animalId}`);
  }

  /**
   * Find or create animal by EID
   */
  async findOrCreateAnimalByEid(farmId: string, eid: string) {
    const response = await this.client.post(`/farm/${farmId}/animals/find-or-create-by-eid`, {
      eid,
    });
    return response.data;
  }

  /**
   * List animal identifiers
   */
  async listAnimalIdentifiers(farmId: string, animalId: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/${animalId}/identifier`);
    return response.data;
  }

  /**
   * Add an identifier to an animal
   */
  async addAnimalIdentifier(
    farmId: string,
    animalId: string,
    data: { type: string; value: string; is_primary?: boolean },
  ) {
    const response = await this.client.post(`/farm/${farmId}/animals/${animalId}/identifier`, data);
    return response.data;
  }

  /**
   * Remove an identifier from an animal
   */
  async removeAnimalIdentifier(farmId: string, animalId: string, identifierId: string) {
    await this.client.delete(`/farm/${farmId}/animals/${animalId}/identifier/${identifierId}`);
  }

  /**
   * List groups in a farm
   */
  async listGroups(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}/groups`);
    return response.data;
  }

  /**
   * List farm memories grouped by key (all versions, newest first per key)
   */
  async listMemories(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}/memory?grouped=true`);
    return response.data;
  }

  /**
   * Get a specific group
   */
  async getGroup(farmId: string, groupId: string) {
    const response = await this.client.get(`/farm/${farmId}/groups/${groupId}`);
    return response.data;
  }

  /**
   * Create a group
   */
  async createGroup(farmId: string, data: { description?: string; name: string }) {
    const response = await this.client.post(`/farm/${farmId}/groups`, data);
    return response.data;
  }

  /**
   * Update a group
   */
  async updateGroup(
    farmId: string,
    groupId: string,
    data: { description?: string; name?: string },
  ) {
    const response = await this.client.put(`/farm/${farmId}/groups/${groupId}`, data);
    return response.data;
  }

  /**
   * Delete (archive) a group
   */
  async deleteGroup(farmId: string, groupId: string) {
    await this.client.delete(`/farm/${farmId}/groups/${groupId}`);
  }

  /**
   * Restore a previously archived group
   */
  async restoreGroup(farmId: string, groupId: string) {
    const response = await this.client.post(`/farm/${farmId}/groups/${groupId}/restore`);
    return response.data;
  }

  /**
   * List records in a farm
   */
  async listRecords(farmId: string, params?: { skip?: number; take?: number; type?: string }) {
    const response = await this.client.get(`/farm/${farmId}/records`, {
      params,
    });
    return response.data;
  }

  /**
   * Get a specific record
   */
  async getRecord(farmId: string, recordId: string) {
    const response = await this.client.get(`/farm/${farmId}/records/${recordId}`);
    return response.data;
  }

  /**
   * Create a record
   */
  async createRecord(
    farmId: string,
    data: {
      applied_at: string;
      description?: string;
      name: string;
      type: string;
      animal_ids?: string[];
      group_ids?: string[];
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/records`, data);
    return response.data;
  }

  /**
   * Update a record
   */
  async updateRecord(
    farmId: string,
    recordId: string,
    data: {
      applied_at?: string;
      description?: string;
      name?: string;
      type?: string;
    },
  ) {
    const response = await this.client.put(`/farm/${farmId}/records/${recordId}`, data);
    return response.data;
  }

  /**
   * Delete a record
   */
  async deleteRecord(farmId: string, recordId: string) {
    await this.client.delete(`/farm/${farmId}/records/${recordId}`);
  }

  /**
   * List chute sessions in a farm
   */
  async listChuteSessions(
    farmId: string,
    params?: { skip?: number; take?: number; status?: string },
  ) {
    const response = await this.client.get(`/farm/${farmId}/chute-sessions`, {
      params,
    });
    return response.data;
  }

  /**
   * Get a specific chute session (including its entries)
   */
  async getChuteSession(farmId: string, sessionId: string) {
    const response = await this.client.get(`/farm/${farmId}/chute-sessions/${sessionId}`);
    return response.data;
  }

  /**
   * List feed rations in a farm
   */
  async listRations(
    farmId: string,
    params?: { skip?: number; take?: number; include_inactive?: boolean },
  ) {
    const response = await this.client.get(`/farm/${farmId}/rations`, {
      params,
    });
    return response.data;
  }

  /**
   * Get a specific ration (including ingredients and assignments)
   */
  async getRation(farmId: string, rationId: string) {
    const response = await this.client.get(`/farm/${farmId}/rations/${rationId}`);
    return response.data;
  }

  /**
   * Create a ration (group assignments land inactive pending in-app activation)
   */
  async createRation(
    farmId: string,
    data: {
      name: string;
      unit?: string;
      ingredients: { name: string; per_head_lbs: number }[];
      assignments?: { group_id: string; feedings_per_day?: number; label?: string }[];
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/rations`, data);
    return response.data;
  }

  /**
   * Propose a chute session (created as PROPOSED; the user starts it in-app)
   */
  async createChuteSession(
    farmId: string,
    data: {
      name?: string;
      config: { widgets: unknown[]; new_animal_fields?: string[]; record_type?: string };
      group_id?: string;
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/chute-sessions`, data);
    return response.data;
  }

  /**
   * List feedings (executed mixer loads) in a farm
   */
  async listFeedings(
    farmId: string,
    params?: { skip?: number; take?: number; status?: string; since?: string },
  ) {
    const response = await this.client.get(`/farm/${farmId}/feedings`, {
      params,
    });
    return response.data;
  }

  /**
   * Update a PROPOSED chute session
   */
  async updateChuteSession(
    farmId: string,
    sessionId: string,
    data: {
      name?: string;
      config?: { widgets: unknown[]; new_animal_fields?: string[]; record_type?: string };
      group_id?: string;
    },
  ) {
    const response = await this.client.put(`/farm/${farmId}/chute-sessions/${sessionId}`, data);
    return response.data;
  }

  /**
   * Get a specific feeding (including its ingredient snapshot and deliveries)
   */
  async getFeeding(farmId: string, feedingId: string) {
    const response = await this.client.get(`/farm/${farmId}/feedings/${feedingId}`);
    return response.data;
  }

  /**
   * List concierge import requests across all farms (admin only)
   */
  async listImportRequests(params?: { skip?: number; take?: number; status?: string }) {
    const response = await this.client.get('/admin/import-request', { params });
    return response.data;
  }

  /**
   * Get one import request with presigned file download URLs (admin only)
   */
  async getImportRequest(importRequestId: string) {
    const response = await this.client.get(`/admin/import-request/${importRequestId}`);
    return response.data;
  }

  /**
   * Update an import request's status (admin only)
   */
  async updateImportRequestStatus(
    importRequestId: string,
    data: { status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; summary?: string },
  ) {
    const response = await this.client.post(
      `/admin/import-request/${importRequestId}/status`,
      data,
    );
    return response.data;
  }
}
