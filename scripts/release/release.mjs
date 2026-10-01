#!/usr/bin/env node
/**
 * Pure release logic shared by the release workflow and its tests.
 *
 * The standalone package repository owns this file; it never imports
 * anything from the Ranch.Bot monorepo. The CLI entrypoint that performs I/O
 * lives in `main.mjs`; everything here is deterministic so it can be unit
 * tested without a registry, network, or GitHub.
 */

import { createHash } from 'node:crypto';

const STABLE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA512_SRI = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** Asset name the release candidate manifest always uses. */
export const MANIFEST_ASSET_NAME = 'release-manifest.json';

/** Every field a release manifest must carry, exactly once. */
const MANIFEST_FIELDS = [
  'repository',
  'packageName',
  'version',
  'tag',
  'sourceSha',
  'integrity',
  'filename',
  'runId',
  'runAttempt',
  'workflow',
  'workflowRef',
];

/** Parse a stable `vX.Y.Z` tag; reject prereleases and malformed refs. */
export function parseStableTag(tag) {
  const match = STABLE_TAG.exec(String(tag ?? '').trim());
  if (!match) {
    throw new Error(
      `Release tag must be stable semver like v1.2.3, received ${JSON.stringify(tag)}`,
    );
  }
  return {
    tag: `v${match[1]}.${match[2]}.${match[3]}`,
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

/**
 * Decide whether publication is enabled. Only the literal string `true`
 * enables the release; absent, empty, and any other value block it.
 */
export function releaseEnabled(value) {
  return value === 'true';
}

/** Assert a version is stable `X.Y.Z`. */
export function assertStableVersion(version) {
  if (!STABLE_VERSION.test(String(version ?? ''))) {
    throw new Error(
      `Version must be stable semver like 1.2.3, received ${JSON.stringify(version)}`,
    );
  }
  return version;
}

/**
 * Assert every declared version matches the release tag. `checks` is a list of
 * `{ label, value }`; the first mismatch names the offending file.
 */
export function assertVersionAlignment(version, checks) {
  assertStableVersion(version);
  for (const { label, value } of checks) {
    if (value !== version) {
      throw new Error(`${label} is ${JSON.stringify(value)}, expected ${JSON.stringify(version)}`);
    }
  }
  return version;
}

/** Build the always-on checks from package metadata plus package-specific extras. */
export function versionChecks({ packageJson, lockfile, extra = [] }) {
  return [
    { label: 'package.json version', value: packageJson?.version },
    { label: 'package-lock.json version', value: lockfile?.version },
    { label: 'package-lock.json packages[""].version', value: lockfile?.packages?.['']?.version },
    ...extra,
  ];
}

/**
 * Find every `<packageName>@<pin>` reference in Markdown, keeping the 1-based
 * line so a mismatch names the exact location. Pins are captured verbatim
 * rather than parsed as semver ranges, so a floating tag like `@latest` or
 * `@^1.1.0` is reported instead of silently accepted.
 */
export function findPackagePins(text, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}@([^\\s\`'"),;\\]]+)`, 'g');
  const pins = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const line = text.slice(0, match.index).split('\n').length;
    pins.push({ line, value: match[1] });
  }
  return pins;
}

/**
 * Build version checks from the pinned `<packageName>@<version>` references in
 * a packaged Markdown file. `requirePins` and `requiredSnippets` let the CLI
 * require its installation copy without forcing a convention on the MCP README.
 */
export function pinnedReferenceChecks({
  text,
  packageName,
  label,
  requirePins = false,
  requiredSnippets = [],
}) {
  if (requirePins) {
    for (const snippet of requiredSnippets) {
      if (!text.includes(snippet)) {
        throw new Error(`${label} must document ${JSON.stringify(snippet)}`);
      }
    }
  }
  const pins = findPackagePins(text, packageName);
  if (requirePins && pins.length === 0) {
    throw new Error(`${label} must pin ${packageName} to an explicit version`);
  }
  return pins.map((pin) => ({
    label: `${label}:${pin.line} ${packageName} pin`,
    value: pin.value,
  }));
}

/**
 * Require a heading for the candidate version in a changelog while leaving
 * historical headings untouched. A missing heading fails closed.
 */
export function assertChangelogHeading({ text, version, label = 'CHANGELOG.md' }) {
  const escaped = String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^#{1,6}\\s*\\[?${escaped}\\]?(?:\\s|$)`, 'm');
  if (!heading.test(text)) {
    throw new Error(`${label} is missing a heading for version ${version}`);
  }
  return [];
}

/**
 * Build checks for the MCP `server.json` version and every npm package entry
 * that publishes this package. A missing npm entry fails closed.
 */
export function serverJsonVersionChecks(serverJson, packageName) {
  const packages = Array.isArray(serverJson?.packages) ? serverJson.packages : [];
  const entries = [];
  packages.forEach((entry, index) => {
    if (entry?.registryType === 'npm' && entry?.identifier === packageName) {
      entries.push({ index, version: entry.version });
    }
  });
  if (entries.length === 0) {
    throw new Error(`server.json has no npm package entry for ${packageName}`);
  }
  return [
    { label: 'server.json version', value: serverJson?.version },
    ...entries.map((entry) => ({
      label: `server.json packages[${entry.index}].version`,
      value: entry.version,
    })),
  ];
}

/**
 * Reject any packed path outside the runtime allowlist. `dirs` are permitted
 * top-level runtime directories, `rootFiles` are exact permitted root files.
 */
export function assertTarballAllowlist(paths, { dirs, rootFiles, requiredRootFiles = [] }) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('Release tarball file list is empty');
  }
  const allowedRootFiles = new Set(['package.json', ...rootFiles]);
  for (const path of paths) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..')) {
      throw new Error(`Unsafe release tarball path: ${JSON.stringify(path)}`);
    }
    if (path.includes('\\')) throw new Error(`Unexpected backslash in release path: ${path}`);
    const isAllowedRootFile = allowedRootFiles.has(path);
    const isAllowedDir = dirs.some((dir) => path.startsWith(`${dir}/`));
    if (!isAllowedRootFile && !isAllowedDir) {
      throw new Error(`Unexpected file in release tarball: ${path}`);
    }
    if (/(^|\/)(__tests__|tests?|coverage|node_modules)(\/|$)|(^|\/)\.env|\.npmrc$/.test(path)) {
      throw new Error(`Forbidden file in release tarball: ${path}`);
    }
  }
  for (const required of ['package.json', ...requiredRootFiles]) {
    if (!paths.includes(required)) throw new Error(`Release tarball is missing ${required}`);
  }
  return paths;
}

/** SHA-512 Subresource Integrity string for a tarball buffer. */
export function sha512Integrity(buffer) {
  return `sha512-${createHash('sha512').update(buffer).digest('base64')}`;
}

/** Assert a value is a SHA-512 SRI. */
export function assertIntegrity(integrity, label = 'integrity') {
  if (!SHA512_SRI.test(String(integrity ?? ''))) {
    throw new Error(`${label} is not a SHA-512 SRI: ${JSON.stringify(integrity)}`);
  }
  return integrity;
}

/**
 * Normalize `npm pack --json` output (an object keyed by package name, or an
 * array) to the single record for this package.
 */
export function parsePackResult(packResult, packageName) {
  const records = Array.isArray(packResult) ? packResult : Object.values(packResult ?? {});
  const record = records.find((entry) => entry?.name === packageName) ?? records[0];
  if (!record?.filename || !record?.integrity) {
    throw new Error(`npm pack output does not describe ${packageName}`);
  }
  return record;
}

/** Build the release-candidate manifest uploaded alongside the tarball. */
export function buildReleaseManifest({
  repository,
  packageName,
  version,
  tag,
  sourceSha,
  integrity,
  filename,
  runId,
  runAttempt,
  workflow,
  workflowRef,
}) {
  if (!REPOSITORY.test(String(repository ?? ''))) {
    throw new Error(`Repository must be owner/name, received ${JSON.stringify(repository)}`);
  }
  if (!COMMIT_SHA.test(String(sourceSha ?? ''))) {
    throw new Error(
      `Source SHA must be a full 40-character commit, received ${JSON.stringify(sourceSha)}`,
    );
  }
  assertStableVersion(version);
  const parsed = parseStableTag(tag);
  if (parsed.version !== version) {
    throw new Error(`Manifest tag ${tag} does not match version ${version}`);
  }
  assertIntegrity(integrity);
  if (!filename) throw new Error('Manifest is missing the tarball filename');
  if (typeof packageName !== 'string' || packageName.length === 0) {
    throw new Error('Manifest is missing the package name');
  }
  const normalizedRunId = String(runId ?? '');
  const normalizedRunAttempt = String(runAttempt ?? '');
  if (!POSITIVE_INTEGER.test(normalizedRunId)) {
    throw new Error(`Manifest runId must be a positive integer, received ${JSON.stringify(runId)}`);
  }
  if (!POSITIVE_INTEGER.test(normalizedRunAttempt)) {
    throw new Error(
      `Manifest runAttempt must be a positive integer, received ${JSON.stringify(runAttempt)}`,
    );
  }
  for (const [label, value] of [
    ['workflow', workflow],
    ['workflowRef', workflowRef],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Manifest ${label} must be a non-empty string`);
    }
  }
  return {
    repository,
    packageName,
    version,
    tag,
    sourceSha,
    integrity,
    filename,
    runId: normalizedRunId,
    runAttempt: normalizedRunAttempt,
    workflow,
    workflowRef,
  };
}

/**
 * Validate a release manifest read from disk or the registry of release
 * assets. Rejects malformed data, missing fields, and unknown fields so a
 * corrupt manifest is never mistaken for a compatible candidate.
 */
export function assertValidManifest(manifest, label = 'release manifest') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const missing = MANIFEST_FIELDS.filter((field) => !(field in manifest));
  const unknown = Object.keys(manifest).filter((field) => !MANIFEST_FIELDS.includes(field));
  if (missing.length || unknown.length) {
    throw new Error(
      `${label} has unexpected fields (missing: ${missing.join(', ') || 'none'}; ` +
        `unknown: ${unknown.join(', ') || 'none'})`,
    );
  }
  if (!REPOSITORY.test(String(manifest.repository ?? ''))) {
    throw new Error(
      `${label} repository must be owner/name, received ${JSON.stringify(manifest.repository)}`,
    );
  }
  if (typeof manifest.packageName !== 'string' || manifest.packageName.length === 0) {
    throw new Error(`${label} packageName must be a non-empty string`);
  }
  assertStableVersion(manifest.version);
  const parsed = parseStableTag(manifest.tag);
  if (parsed.version !== manifest.version) {
    throw new Error(`${label} tag ${manifest.tag} does not match version ${manifest.version}`);
  }
  if (!COMMIT_SHA.test(String(manifest.sourceSha ?? ''))) {
    throw new Error(`${label} sourceSha must be a full 40-character commit`);
  }
  assertIntegrity(manifest.integrity, `${label} integrity`);
  if (typeof manifest.filename !== 'string' || manifest.filename.length === 0) {
    throw new Error(`${label} filename must be a non-empty string`);
  }
  if (!POSITIVE_INTEGER.test(String(manifest.runId ?? ''))) {
    throw new Error(`${label} runId must be a positive integer string`);
  }
  if (!POSITIVE_INTEGER.test(String(manifest.runAttempt ?? ''))) {
    throw new Error(`${label} runAttempt must be a positive integer string`);
  }
  if (typeof manifest.workflow !== 'string' || manifest.workflow.length === 0) {
    throw new Error(`${label} workflow must be a non-empty string`);
  }
  if (typeof manifest.workflowRef !== 'string' || manifest.workflowRef.length === 0) {
    throw new Error(`${label} workflowRef must be a non-empty string`);
  }
  return manifest;
}

/** Parse and validate manifest bytes (Buffer or string). */
export function parseManifest(bytes, label = 'release manifest') {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : bytes;
  if (typeof text !== 'string') throw new Error(`${label} bytes are not readable`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return assertValidManifest(parsed, label);
}

/**
 * Compare the local candidate manifest with an existing one. Everything must
 * match except `runId` and `runAttempt`, which legitimately change on a rerun
 * and must each be a positive-integer string. JSON formatting and key order
 * are irrelevant because only parsed values are compared.
 */
export function compareManifests(local, existing) {
  assertValidManifest(local, 'local release manifest');
  assertValidManifest(existing, 'existing release manifest');
  const differing = MANIFEST_FIELDS.filter(
    (field) => field !== 'runId' && field !== 'runAttempt' && local[field] !== existing[field],
  );
  if (differing.length) {
    throw new Error(
      `Existing release manifest conflicts with the tested candidate (${differing.join(', ')})`,
    );
  }
  return {
    compatible: true,
    existingRunId: existing.runId,
    existingRunAttempt: existing.runAttempt,
  };
}

/**
 * Decide what to do with an existing registry version. Returns
 * `{ publish: true }` only when the version is genuinely absent; an existing
 * version is accepted only when its integrity byte-for-byte matches the tested
 * artifact. Never signals an overwrite.
 */
export function registryDecision({ version, integrity, view }) {
  assertIntegrity(integrity);
  if (view?.exists === false) return { publish: true, reason: 'version is not published yet' };
  const data = view?.data ?? {};
  if (data.version !== version) {
    throw new Error(`Registry returned version ${JSON.stringify(data.version)} for ${version}`);
  }
  if (data.integrity !== integrity) {
    throw new Error(
      `Published ${version} has integrity ${JSON.stringify(data.integrity)}, ` +
        `expected ${integrity}; refusing to overwrite a published version`,
    );
  }
  return { publish: false, reason: 'already published with the exact tested bytes' };
}

/**
 * Classify `npm view` output. A genuine E404 means "not published"; any other
 * failure (network, auth, registry error) is surfaced, never treated as absent.
 */
export function classifyNpmView({ status, stdout = '', stderr = '' }) {
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = null;
  }
  if (status === 0) {
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!data || typeof data !== 'object') {
      throw new Error('npm view returned no JSON metadata');
    }
    return {
      exists: true,
      data: {
        version: data.version,
        integrity: data.dist?.integrity ?? data['dist.integrity'],
        tarball: data.dist?.tarball ?? data['dist.tarball'],
      },
    };
  }
  const code = parsed?.error?.code;
  if (code === 'E404' || /\bE404\b/.test(`${stdout}\n${stderr}`)) return { exists: false };
  throw new Error(`npm view failed (exit ${status}): ${(stderr || stdout).trim()}`);
}

/**
 * Read and classify one registry view through an injected runner. The runner
 * receives `(command, args)` and must throw an Error carrying `status`,
 * `stdout`, and `stderr` on failure. Shared by the pre- and post-publication
 * registry commands so both agree on what a genuine E404 means.
 */
export function readRegistryView({ runner, packageName, version, registry }) {
  let result;
  try {
    const stdout = runner('npm', [
      'view',
      `${packageName}@${version}`,
      'version',
      'dist.integrity',
      'dist.tarball',
      '--json',
      '--registry',
      registry,
    ]);
    result = { status: 0, stdout };
  } catch (error) {
    result = {
      status: error?.status ?? 1,
      stdout: error?.stdout?.toString() ?? '',
      stderr: error?.stderr?.toString() ?? '',
    };
  }
  return classifyNpmView(result);
}

/**
 * Strict post-publication verification. Requires the version to exist with the
 * exact expected integrity. Only a genuine E404 is retried (bounded); auth,
 * network, malformed metadata, and any mismatch fail immediately. Exhausting
 * the retries fails nonzero instead of reporting success.
 */
export async function verifyRegistry({
  version,
  integrity,
  read,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 6,
  intervalMs = 10000,
}) {
  assertStableVersion(version);
  assertIntegrity(integrity);
  if (typeof read !== 'function') throw new Error('verifyRegistry requires a read function');
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(`Registry attempts must be a positive integer, received ${attempts}`);
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const view = read();
    if (view?.exists) {
      registryDecision({ version, integrity, view });
      return { verified: true, attempts: attempt, intervalMs };
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new Error(
    `Registry version ${version} was not visible after ${attempts} checked attempt(s); ` +
      'refusing to report a successful publication',
  );
}

/**
 * Assert an existing release belongs to this tag and source commit. A branch
 * target is allowed; an explicit commit target must equal the tested SHA.
 */
export function assertReleaseIdentity({ tag, sha, release }) {
  if (!release) return release;
  if (release.tagName !== tag) {
    throw new Error(`Existing release is for ${release.tagName}, expected ${tag}`);
  }
  const target = String(release.targetCommitish ?? '');
  if (COMMIT_SHA.test(target) && target !== sha) {
    throw new Error(`Existing release for ${tag} targets ${target}, expected ${sha}`);
  }
  return release;
}

/**
 * Plan GitHub release creation/retry without ever replacing an existing asset.
 * `release` is the `gh release view` payload, or `null` when the release is
 * absent. Size is used only to reject an obviously different asset early; an
 * existing asset is still downloaded and hashed before it is accepted.
 */
export function gitHubReleasePlan({ tag, sha, release, assets }) {
  const names = assets.map((asset) => asset.name);
  if (new Set(names).size !== names.length) {
    throw new Error('Expected release asset names must be unique');
  }
  if (!release) return { create: true, upload: names, existing: [] };
  assertReleaseIdentity({ tag, sha, release });
  if (release.isPrerelease) {
    throw new Error(`Existing release for ${tag} is a prerelease; refusing to alter it`);
  }
  const remote = new Map((release.assets ?? []).map((asset) => [asset.name, asset.size]));
  const existing = [];
  const upload = [];
  for (const asset of assets) {
    if (!remote.has(asset.name)) {
      upload.push(asset.name);
      continue;
    }
    if (
      asset.byteIdentical &&
      asset.size !== undefined &&
      Number(remote.get(asset.name)) !== Number(asset.size)
    ) {
      throw new Error(
        `Existing release asset ${asset.name} differs in size from the tested artifact; ` +
          'refusing to replace it',
      );
    }
    existing.push(asset.name);
  }
  return { create: false, upload, existing };
}

/** Render release notes with pinned install commands and verification evidence. */
export function renderReleaseNotes({
  packageName,
  version,
  generatedNotes = '',
  installCommands = [],
  warnings = [],
  sourceSha,
  integrity,
}) {
  if (!COMMIT_SHA.test(String(sourceSha ?? ''))) {
    throw new Error('Release notes need the full source commit SHA');
  }
  assertIntegrity(integrity);
  const sections = [`# ${packageName} v${version}`];
  if (generatedNotes.trim()) sections.push(generatedNotes.trim());
  sections.push(
    [
      '## Verification',
      '',
      `- Source commit: \`${sourceSha}\``,
      `- Tarball integrity (SHA-512): \`${integrity}\``,
      '- Node.js 22 or newer',
    ].join('\n'),
  );
  if (installCommands.length) {
    sections.push(['## Install', '', '```bash', ...installCommands, '```'].join('\n'));
  }
  if (warnings.length) {
    sections.push(['## Upgrade notes', '', ...warnings.map((line) => `- ${line}`)].join('\n'));
  }
  return `${sections.join('\n\n')}\n`;
}
