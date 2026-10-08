#!/usr/bin/env node
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createInterface } = require('node:readline/promises');
const { z } = require('zod');
const { configuredDefinition, birthInputs } = require('./birthPayloads.cjs');

const inputSchema = z
  .object({
    disposable: z.literal(true),
    farmId: z.string().uuid(),
    damId: z.string().uuid(),
    groupId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tag: z.string().min(1).max(80),
    notes: z.string().max(1000),
    name: z.string().min(1).max(80),
    unit: z.enum(['kg', 'lb']),
    ease: z.enum(['unassisted', 'assisted']),
  })
  .strict();

const requireLoopback = (value) => {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('This example requires a disposable loopback API origin, never production.');
  }
  return url.origin;
};

const runConfiguredBirth = async ({ call, input: rawInput, approve, report = () => {} }) => {
  const input = inputSchema.parse(rawInput);
  const scoped = (name, args = {}) => call(name, { farm_id: input.farmId, ...args });
  const farm = (await call('list_my_farms', {})).farms.find((item) => item.id === input.farmId);
  if (!farm || farm.species !== 'SHEEP')
    throw new Error('Choose an accessible disposable sheep farm.');
  const dam = await scoped('get_animal', { animal_id: input.damId });
  const group = await scoped('get_group', { group_id: input.groupId });
  let starter;
  for (let skip = 0; !starter; ) {
    const page = await scoped('list_workflow_templates', {
      workflow: 'record_birth',
      skip,
      take: 200,
    });
    starter = page.records.find((item) => item.name === 'Detailed lambing');
    skip += page.records.length;
    if (!starter && (!page.records.length || skip >= page.total)) {
      throw new Error('Detailed lambing starter not found. Stop rather than guessing a template.');
    }
  }
  const detail = await scoped('get_workflow_template', { template_id: starter.id });
  const definition = configuredDefinition(detail.current_version.definition, input);
  const nextDefinition = {
    ...definition,
    fields: definition.fields.map((field) =>
      field.key === 'offspring.fostering_notes'
        ? { ...field, label: 'Fostering observation' }
        : field,
    ),
  };
  const plan = {
    farm,
    dam,
    group,
    create: { definition, is_default: false },
    publish: { expected_current_version: 1, definition: nextDefinition },
  };
  if ((await approve('configuration', plan)) !== true)
    throw new Error('Configuration cancelled; no template created.');
  const created = await scoped('create_workflow_template', plan.create);
  report('template_created', { farm_id: input.farmId, template_id: created.id });
  const template = await scoped('publish_workflow_template_version', {
    template_id: created.id,
    ...plan.publish,
  });
  const inputs = birthInputs(input);
  const preview = await scoped('preview_workflow', {
    request_id: randomUUID(),
    template_id: template.id,
    inputs,
  });
  report('preview', preview);
  if (preview.status !== 'pending' || !preview.review || !preview.proposed_changes?.bundle) {
    throw new Error('Preview is not complete and pending. Resolve its issues; do not commit.');
  }
  if ((await approve('birth', { farm, preview })) !== true) {
    throw new Error(`Birth cancelled; preview ${preview.preview_id} remains uncommitted.`);
  }
  const current = await scoped('get_workflow_preview', { preview_id: preview.preview_id });
  if (current.status !== 'pending' || current.preview_hash !== preview.preview_hash) {
    throw new Error(
      'Preview changed. Read it and obtain a fresh approval; do not rerun this example.',
    );
  }
  let saved;
  try {
    saved = await scoped('commit_workflow', {
      preview_id: preview.preview_id,
      approval: { confirmed: true, preview_hash: preview.preview_hash },
    });
  } catch {
    // A lost response is not permission to create or commit again.
    const state = await scoped('get_workflow_preview', { preview_id: preview.preview_id });
    if (state.status !== 'committed' || !state.outcome) {
      throw new Error(
        `Commit not verified for preview ${preview.preview_id}. Read its status; no automatic retry or new preview.`,
      );
    }
    saved = {
      preview_id: state.preview_id,
      status: state.status,
      saved_entity_ids: state.saved_entity_ids,
      outcome: state.outcome,
    };
  }
  const readback = await scoped('get_birth_event', { event_id: saved.outcome.id });
  const record = await scoped('get_record', { record_id: readback.record_id });
  const lamb = await scoped('get_animal', { animal_id: readback.offspring[0].animal_id });
  assert.deepEqual(readback.bundle.input, preview.proposed_changes.bundle);
  assert.equal(readback.workflow_template_id, template.id);
  assert.equal(readback.workflow_template_version_id, template.current_version.id);
  assert.equal(record.id, readback.record_id);
  return { template, definition: nextDefinition, inputs, preview, saved, readback, record, lamb };
};

const main = async () => {
  if (process.argv.length !== 3 || process.argv[2] === '--help') {
    console.log(
      'Usage: RANCHBOT_API_URL=http://127.0.0.1:7004 node configured-birth.cjs input.json\nDisposable sheep farms only. Sign in with ranchbot-mcp login at that origin first.\nReview both prompts: creates a template with versions 1 and 2, then one made-up birth.\nDo not rerun after an uncertain write; read the printed template/preview IDs.',
    );
    return;
  }
  const origin = requireLoopback(process.env.RANCHBOT_API_URL);
  const input = inputSchema.parse(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'configured-birth-example', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(__dirname, '../../dist/index.js')],
    env: {
      ...Object.fromEntries(
        ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME']
          .filter((key) => process.env[key] !== undefined)
          .map((key) => [key, process.env[key]]),
      ),
      RANCHBOT_API_URL: origin,
      RANCHBOT_DEPLOYMENT_MODE: 'cloud',
      MCP_TRANSPORT: 'stdio',
      COGNITO_DEVICE_CLIENT_ID: 'ranchbot-mcp',
    },
    stderr: 'pipe',
  });
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    transport.stderr?.resume();
    await client.connect(transport);
    const tools = new Set((await client.listTools()).tools.map((tool) => tool.name));
    for (const name of [
      'list_my_farms',
      'get_animal',
      'get_group',
      'list_workflow_templates',
      'get_workflow_template',
      'create_workflow_template',
      'publish_workflow_template_version',
      'preview_workflow',
      'get_workflow_preview',
      'commit_workflow',
      'get_birth_event',
      'get_record',
    ]) {
      if (!tools.has(name))
        throw new Error(`Installed server lacks ${name}; no substitute writes.`);
    }
    const result = await runConfiguredBirth({
      input,
      call: async (name, args) => {
        const response = await client.callTool({ name, arguments: args });
        if (response.isError) throw new Error(`Tool failed: ${name}`);
        return JSON.parse(response.content[0].text);
      },
      report: (stage, value) => console.log(stage, JSON.stringify(value, null, 2)),
      approve: async (stage, review) => {
        console.log(JSON.stringify(review, null, 2));
        return (
          (await terminal.question(`Type "approve ${stage}" to save exactly this ${stage}: `)) ===
          `approve ${stage}`
        );
      },
    });
    console.log(
      'Verified saved records:',
      JSON.stringify(
        { birth: result.readback, record: result.record, animal: result.lamb },
        null,
        2,
      ),
    );
  } finally {
    terminal.close();
    await client.close();
  }
};

module.exports = { runConfiguredBirth, inputSchema, requireLoopback };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
