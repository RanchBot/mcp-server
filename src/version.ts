import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Read a package's own version from a `package.json`, rejecting missing or
 * malformed metadata instead of falling back to a hard-coded value.
 */
export function readPackageVersion(path: string): string {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Unable to read package metadata at ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Package metadata at ${path} is not valid JSON`);
  }
  const version = (parsed as { version?: unknown } | null)?.version;
  if (typeof version !== 'string' || !STABLE_VERSION.test(version)) {
    throw new Error(`Package metadata at ${path} has no stable version`);
  }
  return version;
}

/**
 * Single runtime source for the MCP server version. Resolving `package.json`
 * from `__dirname` works from both `src/` and compiled `dist/` and never
 * depends on the process working directory, so it also works for an installed
 * tarball.
 */
export const PACKAGE_VERSION = readPackageVersion(join(__dirname, '..', 'package.json'));
