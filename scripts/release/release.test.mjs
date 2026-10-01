import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as config from './config.mjs';
import {
  MANIFEST_ASSET_NAME,
  assertIntegrity,
  assertReleaseIdentity,
  assertStableVersion,
  assertTarballAllowlist,
  assertValidManifest,
  assertVersionAlignment,
  buildReleaseManifest,
  classifyNpmView,
  compareManifests,
  gitHubReleasePlan,
  parseManifest,
  parsePackResult,
  parseStableTag,
  readRegistryView,
  registryDecision,
  releaseEnabled,
  renderReleaseNotes,
  sha512Integrity,
  verifyRegistry,
  versionChecks,
} from './release.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha = 'a'.repeat(40);
const integrity =
  'sha512-m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw==';

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
  const allowed = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'];
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
        ['package.json', 'README.md', 'LICENSE', 'dist/index.js'],
        config.tarball,
      ),
    /missing dist\/index\.d\.ts/,
  );
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

test('package config reads every version source and pins the runtime allowlist', () => {
  assert.equal(config.repository, 'RanchBot/mcp-server');
  assert.deepEqual(config.tarball.dirs, ['dist']);
  const checks = config.extraVersionChecks(root);
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  assert.equal(checks.length, 4);
  for (const check of checks) {
    assert.equal(check.value, version, `${check.label} must match package.json`);
  }
});
