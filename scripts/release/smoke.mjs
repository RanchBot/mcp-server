#!/usr/bin/env node
/**
 * Installed-tarball smoke test for @ranchbot/mcp-server: the binary must report
 * the tagged version, print help, and complete an offline stdio
 * initialize + tools/list handshake without credentials or network access.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const [binary, expectedVersion] = process.argv.slice(2);
if (!binary || !expectedVersion) {
  throw new Error('usage: smoke.mjs <installed-binary> <expected-version>');
}

const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
if (version !== expectedVersion) {
  throw new Error(`--version printed ${JSON.stringify(version)}, expected ${expectedVersion}`);
}

const help = execFileSync(binary, ['--help'], { encoding: 'utf8' });
if (!help.trim()) throw new Error('--help printed nothing');

const packageRoot = dirname(
  createRequire(realpathSync(binary)).resolve('@ranchbot/mcp-server/package.json'),
);
const example = resolve(packageRoot, 'docs/examples/configured-birth.cjs');
const exampleHelp = execFileSync(process.execPath, [example, '--help'], { encoding: 'utf8' });
if (!exampleHelp.includes('Disposable sheep farms only'))
  throw new Error('Example help is missing');

async function stdioSmoke() {
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === undefined || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timer);
    if (message.error) reject(new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`));
    else resolve(message.result);
  });

  const request = (id, method, params) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  try {
    const init = await request(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'release-smoke', version: '1.0.0' },
    });
    if (init?.serverInfo?.version !== expectedVersion) {
      throw new Error(
        `initialize reported serverInfo.version ${JSON.stringify(init?.serverInfo?.version)}, ` +
          `expected ${expectedVersion}`,
      );
    }
    if (!init?.serverInfo?.name) throw new Error('initialize returned no serverInfo');
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
    const tools = await request(2, 'tools/list', {});
    if (!Array.isArray(tools?.tools) || tools.tools.length === 0) {
      throw new Error('tools/list returned no tools');
    }
    const instructions = init?.instructions ?? '';
    for (const warning of ['Change History', 'reconcile with reads', 'approval']) {
      if (!instructions.includes(warning)) {
        throw new Error(`initialize instructions omit ${warning}`);
      }
    }
    if (!/approximate age is not a date/i.test(instructions)) {
      throw new Error('initialize instructions must keep an approximate age out of birth_date');
    }

    // Installed discovery must expose the read-only lookup, both creating tools, and the
    // deprecated alias with the annotations and warnings an agent needs to choose safely.
    const lookup = tools.tools.find((tool) => tool.name === 'lookup_animal_by_eid');
    if (!lookup) throw new Error('tools/list is missing lookup_animal_by_eid');
    if (lookup.annotations?.readOnlyHint !== true || lookup.annotations?.idempotentHint !== true) {
      throw new Error('lookup_animal_by_eid must be read-only and idempotent');
    }
    if (
      !Array.isArray(lookup.inputSchema?.required) ||
      !lookup.inputSchema.required.includes('eid')
    ) {
      throw new Error('lookup_animal_by_eid must require eid');
    }
    for (const creation of ['find_or_create_animal_by_eid', 'find_animal_by_identifier']) {
      const tool = tools.tools.find((entry) => entry.name === creation);
      if (!tool) throw new Error(`tools/list is missing ${creation}`);
      if (tool.annotations?.readOnlyHint !== false) {
        throw new Error(`${creation} must not be read-only`);
      }
      if (!/creates an animal/i.test(tool.description ?? '')) {
        throw new Error(`${creation} must disclose that it creates inventory`);
      }
    }
    const deprecated = tools.tools.find((tool) => tool.name === 'find_animal_by_identifier');
    if (!/DEPRECATED/.test(deprecated?.description ?? '')) {
      throw new Error('find_animal_by_identifier must be labelled deprecated');
    }

    // The published schema must never tell a client to manufacture a birthday from an age.
    for (const name of ['create_animal', 'update_animal']) {
      const tool = tools.tools.find((entry) => entry.name === name);
      const description = tool?.inputSchema?.properties?.birth_date?.description ?? '';
      if (
        !/Exact date of birth/.test(description) ||
        !/never calculate or estimate a birthday from an age/.test(description)
      ) {
        throw new Error(`${name} birth_date guidance must keep an approximate age approximate`);
      }
      if (/derive it from an age/i.test(description)) {
        throw new Error(`${name} must not derive a birthday from an age`);
      }
    }
    const preview = tools.tools.find((tool) => tool.name === 'preview_birth_event');
    const confirm = tools.tools.find((tool) => tool.name === 'confirm_birth_event');
    for (const birth of [preview, confirm]) {
      if (
        !birth?.description.includes('A saved birth cannot be corrected') ||
        !birth.description.includes('https://ranch.bot/support')
      ) {
        throw new Error('Birth descriptions must preserve the correction boundary');
      }
    }
    if (!confirm?.description.includes('confirmation_hash')) {
      throw new Error('Birth description must preserve confirmation restrictions');
    }
    console.log(`smoke ok: ${binary} --version=${version}, tools=${tools.tools.length}`);
  } finally {
    child.kill('SIGTERM');
  }
}

await stdioSmoke();
