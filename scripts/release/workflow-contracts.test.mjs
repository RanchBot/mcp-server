import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { repository } from './config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (name) => readFileSync(join(root, '.github/workflows', name), 'utf8');
const monorepoRoot = join(root, '..');

/** Split the `jobs:` block into job-name -> body. */
function jobSections(text) {
  const marker = text.indexOf('\njobs:\n');
  const body = marker === -1 ? '' : text.slice(marker);
  const sections = {};
  let current = null;
  for (const line of body.split('\n')) {
    const match = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line);
    if (match) {
      current = match[1];
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return Object.fromEntries(
    Object.entries(sections).map(([name, lines]) => [name, lines.join('\n')]),
  );
}

test('CI workflow is self-contained, read-only, and gated', () => {
  const ci = read('ci.yml');
  assert.match(ci, /^name: CI/m);
  for (const trigger of ['push:', 'pull_request:', 'workflow_dispatch:', 'workflow_call:']) {
    assert.ok(ci.includes(trigger), `CI must declare ${trigger}`);
  }
  assert.match(ci, /permissions:\n {2}contents: read/);
  assert.match(ci, /cancel-in-progress: true/);
  assert.match(ci, /actions\/checkout@v6/);
  assert.match(ci, /actions\/setup-node@v6/);
  assert.match(ci, /persist-credentials: false/);
  assert.match(ci, /node-version: '22'/);
  assert.match(ci, /cache-dependency-path: package-lock\.json/);
  for (const command of [
    'npm ci',
    'npm run typecheck',
    'npm run lint',
    'npm run prettier',
    'npm run check:versions',
    'npm run build',
    'npm test -- --coverage --runInBand',
    'node --test scripts/release/*.test.mjs',
  ]) {
    assert.ok(ci.includes(command), `CI must run ${command}`);
  }
  assert.match(ci, /--testPathPattern="tokenLock\|tokenStorage\|config\.test\|stdioSession"/);
  assert.match(ci, /os: \[macos-latest, windows-latest\]/);
  assert.ok(ci.includes('ci-success'), 'CI needs a final success gate');
  assert.ok(ci.includes('--coverage=false'), 'native jobs must skip coverage');
  assert.ok(!/id-token/.test(ci), 'plain CI must never request an OIDC token');
  assert.ok(!/secrets\./.test(ci), 'plain CI must not reference repository secrets');
  assert.ok(!/NPM_TOKEN|NODE_AUTH_TOKEN/.test(ci), 'plain CI must not use a npm token');
});

test('Release workflow validates before publishing and stays minimal', () => {
  const release = read('release.yml');
  assert.match(release, /^name: Release/m);
  assert.match(release, /tags:\n {6}- 'v\*'/);
  assert.match(release, /permissions:\n {2}contents: read/);
  assert.match(release, /cancel-in-progress: false/);
  assert.match(release, /NPM_RELEASE_ENABLED/);
  assert.match(release, /main\.mjs gate/);
  assert.match(release, /main\.mjs validate-tag/);
  assert.match(release, /persist-credentials: false/);
  assert.match(release, /uses: \.\/\.github\/workflows\/ci\.yml/);
  assert.match(release, /node-version: '22'/);
  assert.match(release, /environment: npm-release/);
  assert.match(release, /RELEASE_GITHUB_TOKEN/);
  assert.match(release, /npm install --global npm@11\.5\.1/);
  assert.match(
    release,
    /npm publish "\.\/candidate\/\$\{\{ needs\.candidate\.outputs\.filename \}\}"/,
    'publish must pass the packed candidate as a file path (./), not a GitHub owner/repo shorthand',
  );
  assert.match(release, /--provenance/);
  assert.match(release, /main\.mjs github-release/);
  assert.ok(!/NPM_TOKEN|NODE_AUTH_TOKEN/.test(release), 'trusted publishing must not use a token');

  const jobs = jobSections(release);
  const oidcJobs = Object.entries(jobs)
    .filter(([, body]) => body.includes('id-token: write'))
    .map(([name]) => name);
  assert.deepEqual(oidcJobs, ['publish'], 'only the publish job may request id-token: write');
  for (const name of ['validate', 'candidate', 'publish', 'github-release']) {
    assert.ok(jobs[name], `release workflow is missing the ${name} job`);
  }
  assert.ok(jobs.validate.includes('merge-base --is-ancestor'), 'tag must be proven on main');
  assert.ok(jobs.candidate.includes('pack-result.json'), 'candidate must pack exactly once');

  // Preflight may publish on a genuine E404; the strict postflight must run
  // after publication even when it was skipped.
  const preflight = jobs.publish.indexOf('main.mjs registry-status');
  const publish = jobs.publish.indexOf('npm publish');
  const postflight = jobs.publish.indexOf('main.mjs verify-registry');
  assert.ok(preflight !== -1, 'publish must inspect the registry before publishing');
  assert.ok(publish !== -1, 'publish must run npm publish');
  assert.ok(postflight !== -1, 'publish must run the strict verify-registry postflight');
  assert.ok(
    preflight < publish && publish < postflight,
    'registry-status must precede npm publish, which must precede verify-registry',
  );
  assert.equal(
    jobs.publish.split('main.mjs registry-status').length - 1,
    1,
    'the strict path must not reuse the loose preflight command after publication',
  );

  // GitHub release is gated on the publish job (and therefore the postflight).
  assert.match(jobs['github-release'], /needs: \[validate, candidate, publish\]/);
  assert.match(jobs['github-release'], /if: needs\.publish\.result == 'success'/);
  for (const flag of ['--version', '--integrity', '--filename']) {
    assert.ok(
      jobs['github-release'].includes(flag),
      `GitHub release must receive the expected ${flag}`,
    );
  }

  // The MCP Registry job runs after npm publication, is gated on the DNS
  // secret and flag, and never requests an OIDC token.
  assert.ok(jobs['mcp-registry'], 'release workflow is missing the mcp-registry job');
  assert.match(jobs['mcp-registry'], /needs: \[validate, candidate, publish\]/);
  assert.match(jobs['mcp-registry'], /if: needs\.publish\.result == 'success'/);
  assert.match(jobs['mcp-registry'], /MCP_REGISTRY_RELEASE_ENABLED/);
  assert.match(jobs['mcp-registry'], /secrets\.MCP_DNS_PRIVATE_KEY/);
  assert.match(jobs['mcp-registry'], /sha256sum --check/);
  assert.match(jobs['mcp-registry'], /main\.mjs registry-publish/);
  assert.ok(!/id-token/.test(jobs['mcp-registry']), 'mcp-registry must not request an OIDC token');

  const main = readFileSync(join(root, 'scripts/release/main.mjs'), 'utf8');
  assert.match(main, /ranchbot-dev/, 'GitHub release identity must be ranchbot-dev');
});

test('monorepo root jobs run the release helper suites', (t) => {
  const rootCi = join(monorepoRoot, '.github/workflows/ci.yml');
  if (!existsSync(join(monorepoRoot, 'AGENTS.md')) || !existsSync(rootCi)) {
    t.skip('standalone export: no monorepo root CI to inspect');
    return;
  }
  const jobs = jobSections(readFileSync(rootCi, 'utf8'));
  const expected = repository === 'RanchBot/cli' ? 'cli-ci' : 'mcp-server-ci';
  assert.ok(jobs[expected], `root CI must define the ${expected} job`);
  assert.ok(
    jobs[expected].includes('npm run test:release'),
    `root ${expected} must run the release helper tests`,
  );
  assert.ok(
    jobs[expected].includes('npm run check:versions'),
    `root ${expected} must check version metadata before publication`,
  );
});

test('release helpers keep the expected repository identity', () => {
  assert.equal(repository, 'RanchBot/mcp-server');
});
