#!/usr/bin/env node
/**
 * Installed-tarball smoke test for @ranchbot/mcp-server: the binary must report
 * the tagged version, print help, and complete an offline stdio
 * initialize + tools/list handshake without credentials or network access.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

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
    for (const tool of tools.tools) {
      if (tool.annotations?.readOnlyHint === true || tool.name === 'set_default_farm') continue;
      for (const warning of ['app confirmation screen', 'Change History', 'reconcile with reads']) {
        if (!tool.description.includes(warning)) throw new Error(`${tool.name} omits ${warning}`);
      }
    }
    const birth = tools.tools.find((tool) => tool.name === 'confirm_birth_event');
    if (
      !birth?.description.includes('A saved birth cannot be corrected') ||
      !birth.description.includes('confirmation_hash')
    ) {
      throw new Error('Birth description must preserve confirmation and correction restrictions');
    }
    console.log(`smoke ok: ${binary} --version=${version}, tools=${tools.tools.length}`);
  } finally {
    child.kill('SIGTERM');
  }
}

await stdioSmoke();
