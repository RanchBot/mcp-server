import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as config from './config.mjs';
import {
  MANIFEST_ASSET_NAME,
  assertChangelogHeading,
  assertIntegrity,
  assertReleaseIdentity,
  assertStableVersion,
  assertTarballAllowlist,
  assertValidManifest,
  assertVersionAlignment,
  buildReleaseManifest,
  classifyMcpRegistryView,
  classifyNpmView,
  compareManifests,
  findPackagePins,
  gitHubReleasePlan,
  mcpRegistryDecision,
  parseManifest,
  parsePackResult,
  parseStableTag,
  pinnedReferenceChecks,
  readRegistryView,
  registryDecision,
  releaseEnabled,
  renderReleaseNotes,
  serverJsonVersionChecks,
  sha512Integrity,
  verifyMcpRegistryEntry,
  verifyRegistry,
  versionChecks,
} from './release.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha = 'a'.repeat(40);
const integrity =
  'sha512-m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw==';

test('packaged README refuses saved-birth correction and limits fresh previews to unconfirmed proposals', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8').replace(/\s+/g, ' ');

  assert.match(readme, /Before confirmation only, changes to an unconfirmed proposal/);
  assert.match(readme, /Saved birth correction is not currently supported/);
  assert.match(readme, /stop and refer the producer to https:\/\/ranch\.bot\/support/);
  assert.match(readme, /Do not promise an amendment/);
  assert.match(readme, /Never re-record a saved birth/);
  assert.match(readme, /new preview\/confirmation, a new `request_id`/);
  assert.match(
    readme,
    /stripped or forged source provenance, or generic animal, record, or task edits/,
  );
  assert.match(readme, /even with producer approval/);
  assert.match(readme, /unchanged retry of the exact approved tuple.*not a correction/);
  assert.match(readme, /outcome is uncertain, reconcile with reads before any further write/);
  assert.doesNotMatch(readme, /Corrections (?:or changed evidence )?require a fresh preview/);
});

test('only the literal true enables publication', () => {
  assert.equal(releaseEnabled('true'), true);
  for (const value of ['false', 'TRUE', '1', '', undefined, null]) {
    assert.equal(releaseEnabled(value), false);
  }
});

test('accepts only stable version tags', () => {
  assert.deepEqual(parseStableTag('v1.2.3'), { tag: 'v1.2.3', version: '1.2.3' });
  for (const bad of ['1.2.3', 'v1.2', 'v1.2.3-rc.1', 'v01.2.3', 'latest', '']) {
    assert.throws(() => parseStableTag(bad), /stable semver/);
  }
});

test('rejects malformed versions', () => {
  assert.equal(assertStableVersion('1.2.3'), '1.2.3');
  for (const bad of ['1.2', 'v1.2.3', '1.2.3-beta', undefined]) {
    assert.throws(() => assertStableVersion(bad), /stable semver/);
  }
});

test('requires every declared version to match the tag', () => {
  const checks = [
    { label: 'package.json version', value: '1.2.3' },
    { label: 'src/index.ts version', value: '1.2.3' },
  ];
  assert.equal(assertVersionAlignment('1.2.3', checks), '1.2.3');
  assert.throws(
    () => assertVersionAlignment('1.2.3', [{ label: 'src/index.ts version', value: '1.2.2' }]),
    /src\/index\.ts version is "1\.2\.2", expected "1\.2\.3"/,
  );
});

test('builds package metadata version checks', () => {
  const checks = versionChecks({
    packageJson: { version: '1.0.0' },
    lockfile: { version: '1.0.0', packages: { '': { version: '1.0.0' } } },
    extra: [{ label: 'extra', value: '1.0.0' }],
  });
  assert.deepEqual(
    checks.map((check) => check.label),
    [
      'package.json version',
      'package-lock.json version',
      'package-lock.json packages[""].version',
      'extra',
    ],
  );
});

test('enforces the tarball runtime allowlist', () => {
  const allowed = [
    'package.json',
    'README.md',
    'MAINTAINING.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'LICENSE',
    'docs/workflows.md',
    'docs/architecture.md',
    'docs/development.md',
    'docs/troubleshooting.md',
    'dist/index.js',
    'dist/index.d.ts',
    'skills/ranchbot/SKILL.md',
    'skills/ranchbot/references/cli.md',
  ];
  assert.equal(assertTarballAllowlist(allowed, config.tarball), allowed);
  for (const unexpected of ['src/index.ts', 'scripts/release/main.mjs', 'PUBLISHING.md']) {
    assert.throws(
      () => assertTarballAllowlist([...allowed, unexpected], config.tarball),
      /Unexpected file/,
    );
  }
  assert.throws(
    () => assertTarballAllowlist([...allowed, 'dist/__tests__/x.js'], config.tarball),
    /Forbidden file/,
  );
  assert.throws(
    () => assertTarballAllowlist([...allowed, '.env'], config.tarball),
    /Unexpected file|Forbidden file/,
  );
  assert.throws(() => assertTarballAllowlist(['dist/../secret'], config.tarball), /Unsafe/);
  assert.throws(() => assertTarballAllowlist(['/etc/passwd'], config.tarball), /Unsafe/);
  assert.throws(
    () => assertTarballAllowlist(['dist/index.js', 'README.md', 'LICENSE'], config.tarball),
    /missing package\.json/,
  );
  assert.throws(
    () =>
      assertTarballAllowlist(
        allowed.filter((path) => path !== 'dist/index.d.ts'),
        config.tarball,
      ),
    /missing dist\/index\.d\.ts/,
  );
  for (const document of config.requiredDocuments) {
    assert.throws(
      () =>
        assertTarballAllowlist(
          allowed.filter((path) => path !== document),
          config.tarball,
        ),
      new RegExp(`missing ${document.replace(/[/.]/g, '\\$&')}`),
    );
  }
});

test('computes SHA-512 SRI and validates it', () => {
  assert.equal(sha512Integrity(Buffer.from('hello')), integrity);
  assert.equal(assertIntegrity(integrity), integrity);
  assert.throws(() => assertIntegrity('sha256-abc'), /SHA-512 SRI/);
});

test('normalizes npm pack output shapes', () => {
  const record = { name: config.packageName, filename: 'ranchbot-cli-1.2.3.tgz', integrity };
  assert.equal(
    parsePackResult({ [config.packageName]: record }, config.packageName).filename,
    record.filename,
  );
  assert.equal(parsePackResult([record], config.packageName).filename, record.filename);
  assert.throws(() => parsePackResult([{ name: 'other' }], config.packageName), /npm pack/);
});

test('builds a release manifest and rejects bad identity', () => {
  const manifest = buildReleaseManifest({
    repository: config.repository,
    packageName: config.packageName,
    version: '1.2.3',
    tag: 'v1.2.3',
    sourceSha: sha,
    integrity,
    filename: 'ranchbot-cli-1.2.3.tgz',
    runId: '42',
    runAttempt: '1',
    workflow: 'Release',
    workflowRef: `${config.repository}/.github/workflows/release.yml@refs/tags/v1.2.3`,
  });
  assert.equal(manifest.sourceSha, sha);
  assert.equal(manifest.runId, '42');
  assert.throws(() => buildReleaseManifest({ ...manifest, sourceSha: 'abc' }), /40-character/);
  assert.throws(() => buildReleaseManifest({ ...manifest, tag: 'v9.9.9' }), /does not match/);
  assert.throws(() => buildReleaseManifest({ ...manifest, repository: 'bad' }), /owner\/name/);
  assert.throws(() => buildReleaseManifest({ ...manifest, runId: '0' }), /runId/);
  assert.throws(() => buildReleaseManifest({ ...manifest, runAttempt: 'one' }), /runAttempt/);
  assert.throws(() => buildReleaseManifest({ ...manifest, workflow: '' }), /workflow/);
  assert.throws(() => buildReleaseManifest({ ...manifest, workflowRef: '' }), /workflowRef/);
});

test('validates, parses, and compares release manifests', () => {
  const base = buildReleaseManifest({
    repository: config.repository,
    packageName: config.packageName,
    version: '1.2.3',
    tag: 'v1.2.3',
    sourceSha: sha,
    integrity,
    filename: 'ranchbot-cli-1.2.3.tgz',
    runId: '42',
    runAttempt: '1',
    workflow: 'Release',
    workflowRef: `${config.repository}/.github/workflows/release.yml@refs/tags/v1.2.3`,
  });
  assert.equal(assertValidManifest(base), base);
  assert.equal(parseManifest(Buffer.from(JSON.stringify(base))).runId, '42');
  assert.throws(() => parseManifest(Buffer.from('not json'), 'x'), /not valid JSON/);
  assert.throws(() => assertValidManifest({ ...base, extra: true }), /unknown: extra/);
  assert.throws(() => {
    const missing = { ...base };
    delete missing.integrity;
    assertValidManifest(missing);
  }, /missing: integrity/);

  // Reruns legitimately change runId/runAttempt; formatting and key order do not matter.
  const rerun = buildReleaseManifest({
    ...base,
    runId: '99',
    runAttempt: '2',
  });
  assert.equal(compareManifests(base, rerun).compatible, true);
  const reordered = Object.fromEntries(Object.entries(base).reverse());
  assert.equal(compareManifests(base, reordered).compatible, true);

  // Any other change is a conflict.
  assert.throws(() => compareManifests(base, { ...base, sourceSha: 'b'.repeat(40) }), /conflicts/);
  assert.throws(() => compareManifests(base, { ...base, integrity: 'sha512-other' }), /conflicts/);
  assert.throws(() => compareManifests(base, { ...base, runId: '0' }), /runId/);
});

test('registry decisions never overwrite a version', () => {
  assert.deepEqual(registryDecision({ version: '1.2.3', integrity, view: { exists: false } }), {
    publish: true,
    reason: 'version is not published yet',
  });
  assert.equal(
    registryDecision({
      version: '1.2.3',
      integrity,
      view: { exists: true, data: { version: '1.2.3', integrity } },
    }).publish,
    false,
  );
  assert.throws(
    () =>
      registryDecision({
        version: '1.2.3',
        integrity,
        view: { exists: true, data: { version: '1.2.3', integrity: 'sha512-other' } },
      }),
    /refusing to overwrite/,
  );
});

test('classifies npm view as absent only on a real E404', () => {
  assert.deepEqual(
    classifyNpmView({
      status: 0,
      stdout: JSON.stringify({ version: '1.2.3', 'dist.integrity': integrity }),
    }),
    { exists: true, data: { version: '1.2.3', integrity, tarball: undefined } },
  );
  assert.deepEqual(
    classifyNpmView({
      status: 0,
      stdout: JSON.stringify([{ version: '1.2.3', dist: { integrity } }]),
    }),
    { exists: true, data: { version: '1.2.3', integrity, tarball: undefined } },
  );
  assert.equal(
    classifyNpmView({
      status: 1,
      stdout: JSON.stringify({ error: { code: 'E404' } }),
      stderr: 'npm error 404',
    }).exists,
    false,
  );
  assert.equal(classifyNpmView({ status: 1, stderr: 'npm error code E404' }).exists, false);
  assert.throws(
    () => classifyNpmView({ status: 1, stderr: 'npm error code EAI_AGAIN' }),
    /npm view failed/,
  );
});

test('github release plan is retry-safe and additive', () => {
  const assets = [
    { name: 'pkg.tgz', size: 10, byteIdentical: true },
    { name: 'manifest.json', size: 3 },
  ];
  assert.deepEqual(gitHubReleasePlan({ tag: 'v1.2.3', sha, release: null, assets }), {
    create: true,
    upload: ['pkg.tgz', 'manifest.json'],
    existing: [],
  });
  assert.deepEqual(
    gitHubReleasePlan({
      tag: 'v1.2.3',
      sha,
      release: {
        tagName: 'v1.2.3',
        targetCommitish: sha,
        isPrerelease: false,
        assets: [{ name: 'pkg.tgz', size: 10 }],
      },
      assets,
    }),
    { create: false, upload: ['manifest.json'], existing: ['pkg.tgz'] },
  );
  assert.throws(
    () =>
      gitHubReleasePlan({
        tag: 'v1.2.3',
        sha,
        release: {
          tagName: 'v1.2.3',
          targetCommitish: sha,
          isPrerelease: false,
          assets: [{ name: 'pkg.tgz', size: 999 }],
        },
        assets,
      }),
    /differs in size/,
  );
  assert.throws(
    () =>
      gitHubReleasePlan({
        tag: 'v1.2.3',
        sha,
        release: { tagName: 'v1.2.3', targetCommitish: sha, isPrerelease: true, assets: [] },
        assets,
      }),
    /prerelease/,
  );
  assert.throws(
    () =>
      gitHubReleasePlan({
        tag: 'v1.2.3',
        sha,
        release: {
          tagName: 'v1.2.3',
          targetCommitish: 'b'.repeat(40),
          isPrerelease: false,
          assets: [],
        },
        assets,
      }),
    /targets/,
  );
  assert.throws(
    () =>
      gitHubReleasePlan({
        tag: 'v1.2.3',
        sha,
        release: {
          tagName: 'v1.2.3',
          targetCommitish: sha,
          isPrerelease: false,
          assets: [],
        },
        assets: [assets[0], assets[0]],
      }),
    /unique/,
  );
  assert.deepEqual(
    gitHubReleasePlan({
      tag: 'v1.2.3',
      sha,
      release: { tagName: 'v1.2.3', targetCommitish: 'main', isPrerelease: false, assets: [] },
      assets,
    }),
    { create: false, upload: ['pkg.tgz', 'manifest.json'], existing: [] },
  );
});

test('assertReleaseIdentity rejects wrong tag or commit target', () => {
  assert.equal(assertReleaseIdentity({ tag: 'v1.2.3', sha, release: null }), null);
  assert.throws(
    () => assertReleaseIdentity({ tag: 'v1.2.3', sha, release: { tagName: 'v9.9.9' } }),
    /expected v1\.2\.3/,
  );
  assert.throws(
    () =>
      assertReleaseIdentity({
        tag: 'v1.2.3',
        sha,
        release: { tagName: 'v1.2.3', targetCommitish: 'b'.repeat(40) },
      }),
    /targets/,
  );
});

test('readRegistryView classifies npm output and never treats hard errors as absent', () => {
  const version = '1.2.3';
  const registry = 'https://registry.npmjs.org';
  const view = readRegistryView({
    runner: () => JSON.stringify({ version, 'dist.integrity': integrity }),
    packageName: config.packageName,
    version,
    registry,
  });
  assert.equal(view.exists, true);
  assert.equal(view.data.integrity, integrity);
  assert.equal(
    readRegistryView({
      runner: () => {
        const error = new Error('not found');
        error.status = 1;
        error.stdout = JSON.stringify({ error: { code: 'E404' } });
        error.stderr = 'npm error 404';
        throw error;
      },
      packageName: config.packageName,
      version,
      registry,
    }).exists,
    false,
  );
  assert.throws(
    () =>
      readRegistryView({
        runner: () => {
          const error = new Error('network');
          error.status = 1;
          error.stderr = 'npm error code EAI_AGAIN';
          throw error;
        },
        packageName: config.packageName,
        version,
        registry,
      }),
    /EAI_AGAIN/,
  );
  assert.throws(
    () =>
      readRegistryView({
        runner: () => {
          const error = new Error('timeout');
          error.status = null;
          error.stderr = '';
          throw error;
        },
        packageName: config.packageName,
        version,
        registry,
      }),
    /npm view failed/,
  );
  assert.throws(
    () =>
      readRegistryView({
        runner: () => 'not json',
        packageName: config.packageName,
        version,
        registry,
      }),
    /no JSON metadata/,
  );
});

test('verifyRegistry fails closed and retries only a genuine E404', async () => {
  const noop = () => Promise.resolve();
  // A genuine E404 that never resolves must exhaust the bounded attempts.
  let reads = 0;
  await assert.rejects(
    verifyRegistry({
      version: '1.2.3',
      integrity,
      read: () => {
        reads += 1;
        return { exists: false };
      },
      sleep: noop,
      attempts: 3,
    }),
    /not visible after 3/,
  );
  assert.equal(reads, 3);

  // A real E404 followed by matching metadata succeeds on the second read.
  const sleeps = [];
  let call = 0;
  const result = await verifyRegistry({
    version: '1.2.3',
    integrity,
    read: () => {
      call += 1;
      return call === 1
        ? { exists: false }
        : { exists: true, data: { version: '1.2.3', integrity } };
    },
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    attempts: 6,
    intervalMs: 10000,
  });
  assert.deepEqual(result, { verified: true, attempts: 2, intervalMs: 10000 });
  assert.deepEqual(sleeps, [10000]);

  // Immediate matching metadata succeeds with a single read.
  assert.equal(
    (
      await verifyRegistry({
        version: '1.2.3',
        integrity,
        read: () => ({ exists: true, data: { version: '1.2.3', integrity } }),
        sleep: noop,
      })
    ).attempts,
    1,
  );

  // Version or integrity mismatches fail immediately instead of retrying.
  let mismatchReads = 0;
  await assert.rejects(
    verifyRegistry({
      version: '1.2.3',
      integrity,
      read: () => {
        mismatchReads += 1;
        return { exists: true, data: { version: '1.2.3', integrity: 'sha512-other' } };
      },
      sleep: noop,
    }),
    /refusing to overwrite/,
  );
  assert.equal(mismatchReads, 1);

  // A version mismatch also fails immediately.
  let versionMismatchReads = 0;
  await assert.rejects(
    verifyRegistry({
      version: '1.2.3',
      integrity,
      read: () => {
        versionMismatchReads += 1;
        return { exists: true, data: { version: '1.2.4', integrity } };
      },
      sleep: noop,
    }),
    /Registry returned version/,
  );
  assert.equal(versionMismatchReads, 1);

  // A hard read failure propagates without being retried as absent.
  let hardReads = 0;
  await assert.rejects(
    verifyRegistry({
      version: '1.2.3',
      integrity,
      read: () => {
        hardReads += 1;
        throw new Error('registry authentication failed');
      },
      sleep: noop,
    }),
    /authentication failed/,
  );
  assert.equal(hardReads, 1);

  // Defaults are six attempts ten seconds apart.
  let defaultReads = 0;
  const defaultSleeps = [];
  await assert.rejects(
    verifyRegistry({
      version: '1.2.3',
      integrity,
      read: () => {
        defaultReads += 1;
        return { exists: false };
      },
      sleep: (ms) => {
        defaultSleeps.push(ms);
        return Promise.resolve();
      },
    }),
  );
  assert.equal(defaultReads, 6);
  assert.deepEqual(defaultSleeps, [10000, 10000, 10000, 10000, 10000]);
});

test('manifest asset name is stable', () => {
  assert.equal(MANIFEST_ASSET_NAME, 'release-manifest.json');
});

test('renders release notes with pinned commands and evidence', () => {
  const notes = renderReleaseNotes({
    packageName: config.packageName,
    version: '1.2.3',
    generatedNotes: 'Fixes things.',
    installCommands: config.installCommands.map((command) =>
      command.replace('${version}', '1.2.3'),
    ),
    warnings: config.warnings,
    sourceSha: sha,
    integrity,
  });
  const name = config.packageName.replace('/', '\\/');
  assert.match(notes, new RegExp(`# ${name} v1\\.2\\.3`));
  assert.match(notes, /Fixes things\./);
  assert.match(notes, new RegExp(sha));
  assert.match(notes, new RegExp(`npm install -g ${name}@1\\.2\\.3`));
  assert.match(notes, /stopping any older/);
  assert.throws(
    () =>
      renderReleaseNotes({
        packageName: config.packageName,
        version: '1.2.3',
        sourceSha: 'short',
        integrity,
      }),
    /source commit SHA/,
  );
});

test('finds package install pins with their line', () => {
  const text = [
    '# Title',
    'npm install -g @ranchbot/cli@1.1.0',
    '',
    'npx -y @ranchbot/cli@1.1.1 --help',
    'an unrelated @ranchbot/mcp-server@0.1.1 reference',
  ].join('\n');
  assert.deepEqual(findPackagePins(text, '@ranchbot/cli'), [
    { line: 2, value: '1.1.0' },
    { line: 4, value: '1.1.1' },
  ]);
});

test('packaged README pins must be present, explicit, and matched', () => {
  const requiredSnippets = ['npm install -g @ranchbot/cli@', 'npx -y @ranchbot/cli@'];
  const checks = pinnedReferenceChecks({
    text: 'npm install -g @ranchbot/cli@1.1.1\nnpx -y @ranchbot/cli@1.1.1 --help',
    packageName: '@ranchbot/cli',
    label: 'README.md',
    requirePins: true,
    requiredSnippets,
  });
  assert.deepEqual(checks, [
    { label: 'README.md:1 @ranchbot/cli pin', value: '1.1.1' },
    { label: 'README.md:2 @ranchbot/cli pin', value: '1.1.1' },
  ]);

  // The exact reported failure: candidate 1.1.1 with a README pin at 1.1.0.
  assert.throws(
    () =>
      assertVersionAlignment(
        '1.1.1',
        pinnedReferenceChecks({
          text: 'npx -y @ranchbot/cli@1.1.0',
          packageName: '@ranchbot/cli',
          label: 'README.md',
        }),
      ),
    /README\.md:1 @ranchbot\/cli pin is "1\.1\.0", expected "1\.1\.1"/,
  );

  // Malformed and floating pins are reported verbatim.
  for (const pin of ['latest', '^1.1.0', '1.1']) {
    assert.throws(
      () =>
        assertVersionAlignment(
          '1.1.1',
          pinnedReferenceChecks({
            text: `@ranchbot/cli@${pin}`,
            packageName: '@ranchbot/cli',
            label: 'README.md',
          }),
        ),
      /expected "1\.1\.1"/,
    );
  }

  // Required installation copy and explicit pins fail closed when missing.
  assert.throws(
    () =>
      pinnedReferenceChecks({
        text: 'npx -y @ranchbot/cli@1.1.1',
        packageName: '@ranchbot/cli',
        label: 'README.md',
        requirePins: true,
        requiredSnippets,
      }),
    /must document "npm install -g @ranchbot\/cli@"/,
  );
  assert.throws(
    () =>
      pinnedReferenceChecks({
        text: 'no install copy',
        packageName: '@ranchbot/cli',
        label: 'README.md',
        requirePins: true,
      }),
    /must pin @ranchbot\/cli/,
  );

  // The generic helper permits no pins only when the caller opts out.
  assert.deepEqual(
    pinnedReferenceChecks({ text: 'plain README', packageName: '@ranchbot/mcp-server' }),
    [],
  );
});

test('requires the candidate changelog heading and keeps history', () => {
  const text = '# Changelog\n\n## 1.1.1\n\n- now\n\n## 1.1.0\n\n- before\n';
  assert.doesNotThrow(() => assertChangelogHeading({ text, version: '1.1.1' }));
  assert.throws(
    () => assertChangelogHeading({ text, version: '1.2.0' }),
    /missing a heading for version 1\.2\.0/,
  );
});

test('checks every MCP server.json npm entry and fails when absent', () => {
  const serverJson = {
    version: '0.1.1',
    packages: [
      { registryType: 'npm', identifier: '@ranchbot/mcp-server', version: '0.1.1' },
      { registryType: 'oci', identifier: 'example', version: '9.9.9' },
    ],
  };
  assert.deepEqual(
    serverJsonVersionChecks(serverJson, '@ranchbot/mcp-server').map((check) => check.label),
    ['server.json version', 'server.json packages[0].version'],
  );
  assert.throws(
    () => serverJsonVersionChecks({ version: '0.1.1', packages: [] }, '@ranchbot/mcp-server'),
    /no npm package entry/,
  );
  assert.throws(
    () =>
      assertVersionAlignment(
        '0.1.1',
        serverJsonVersionChecks(
          {
            version: '0.1.1',
            packages: [
              { registryType: 'npm', identifier: '@ranchbot/mcp-server', version: '0.1.0' },
            ],
          },
          '@ranchbot/mcp-server',
        ),
      ),
    /server\.json packages\[0\]\.version is "0\.1\.0", expected "0\.1\.1"/,
  );
});

test('each package-lock version field fails independently', () => {
  const base = {
    packageJson: { version: '1.1.1' },
    lockfile: { version: '1.1.1', packages: { '': { version: '1.1.1' } } },
  };
  assert.equal(assertVersionAlignment('1.1.1', versionChecks(base)), '1.1.1');
  assert.throws(
    () =>
      assertVersionAlignment(
        '1.1.1',
        versionChecks({ ...base, lockfile: { ...base.lockfile, version: '1.1.0' } }),
      ),
    /package-lock\.json version is "1\.1\.0", expected "1\.1\.1"/,
  );
  assert.throws(
    () =>
      assertVersionAlignment(
        '1.1.1',
        versionChecks({
          ...base,
          lockfile: { ...base.lockfile, packages: { '': { version: '1.1.0' } } },
        }),
      ),
    /package-lock\.json packages\[""\]\.version is "1\.1\.0", expected "1\.1\.1"/,
  );
});

test('local candidate checks pass without credentials or registry access', () => {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const checks = versionChecks({ packageJson, lockfile, extra: config.extraVersionChecks(root) });
  assert.equal(assertVersionAlignment(packageJson.version, checks), packageJson.version);
});

test('package config checks MCP metadata and README pins', () => {
  assert.equal(config.repository, 'RanchBot/mcp-server');
  assert.deepEqual(config.tarball.dirs, ['dist', 'docs', 'skills']);
  assert.ok(
    config.tarball.requiredRootFiles.includes('skills/ranchbot/SKILL.md'),
    'the public agent skill must survive packing',
  );
  for (const document of config.requiredDocuments) {
    assert.ok(
      config.tarball.requiredRootFiles.includes(document),
      `${document} must survive packing`,
    );
  }
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const checks = config.extraVersionChecks(root);
  assert.equal(
    checks.length,
    3,
    'server.json, npm package entry and README install pin are checked',
  );
  for (const check of checks) {
    assert.equal(check.value, version, `${check.label} must match package.json`);
  }
});

const mcpRegistryResponse = (server = {}) => ({
  servers: [
    {
      server: {
        name: 'bot.ranch/mcp-server',
        version: '0.1.2',
        packages: [
          {
            registryType: 'npm',
            identifier: '@ranchbot/mcp-server',
            transport: { type: 'stdio' },
          },
        ],
        ...server,
      },
      _meta: { 'io.modelcontextprotocol.registry/official': { isLatest: true } },
    },
  ],
});

test('package config pins the MCP Registry publisher and secret', () => {
  assert.equal(config.mcpRegistry.serverName, 'bot.ranch/mcp-server');
  assert.equal(config.mcpRegistry.domain, 'ranch.bot');
  assert.equal(config.mcpRegistry.enabledVariable, 'MCP_REGISTRY_RELEASE_ENABLED');
  assert.equal(config.mcpRegistry.privateKeySecret, 'MCP_DNS_PRIVATE_KEY');
  assert.match(config.mcpRegistry.publisherSha256, /^[a-f0-9]{64}$/);
});

test('classifies and decides on the MCP Registry entry', () => {
  const name = 'bot.ranch/mcp-server';
  const present = classifyMcpRegistryView({ name, version: '0.1.2', json: mcpRegistryResponse() });
  assert.deepEqual(present, {
    exists: true,
    data: {
      name,
      version: '0.1.2',
      npm: '@ranchbot/mcp-server',
      transport: 'stdio',
      isLatest: true,
    },
  });
  assert.deepEqual(
    classifyMcpRegistryView({ name, version: '9.9.9', json: mcpRegistryResponse() }),
    { exists: false },
  );
  assert.deepEqual(
    mcpRegistryDecision({
      version: '0.1.2',
      view: { exists: false },
      serverName: name,
      packageName: '@ranchbot/mcp-server',
    }),
    { publish: true, reason: 'version is not published yet' },
  );
  assert.deepEqual(
    mcpRegistryDecision({
      version: '0.1.2',
      view: present,
      serverName: name,
      packageName: '@ranchbot/mcp-server',
    }),
    { publish: false, reason: 'already published with the expected metadata' },
  );
  const wrongNpm = classifyMcpRegistryView({
    name,
    version: '0.1.2',
    json: mcpRegistryResponse({
      packages: [
        {
          registryType: 'npm',
          identifier: '@ranchbot/other',
          transport: { type: 'stdio' },
        },
      ],
    }),
  });
  assert.throws(
    () =>
      mcpRegistryDecision({
        version: '0.1.2',
        view: wrongNpm,
        serverName: name,
        packageName: '@ranchbot/mcp-server',
      }),
    /uses npm "@ranchbot\/other"/,
  );
  assert.throws(
    () => classifyMcpRegistryView({ name, version: '0.1.2', json: { metadata: {} } }),
    /no server list/,
  );
});

test('verifies the MCP Registry entry with bounded retries', async () => {
  const name = 'bot.ranch/mcp-server';
  const present = () =>
    classifyMcpRegistryView({ name, version: '0.1.2', json: mcpRegistryResponse() });
  const reads = [];
  const result = await verifyMcpRegistryEntry({
    version: '0.1.2',
    serverName: name,
    packageName: '@ranchbot/mcp-server',
    read: () => {
      reads.push(reads.length + 1);
      return reads.length < 3 ? { exists: false } : present();
    },
    sleep: () => Promise.resolve(),
  });
  assert.deepEqual(result, { verified: true, attempts: 3, intervalMs: 10000 });
  assert.deepEqual(reads, [1, 2, 3]);
  await assert.rejects(
    () =>
      verifyMcpRegistryEntry({
        version: '0.1.2',
        serverName: name,
        packageName: '@ranchbot/mcp-server',
        read: () => ({ exists: false }),
        sleep: () => Promise.resolve(),
        attempts: 2,
      }),
    /not visible after 2 checked attempt/,
  );
});
