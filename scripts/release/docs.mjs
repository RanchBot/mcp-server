/**
 * Dependency-free validator for the package's public Markdown documentation.
 *
 * It keeps the exported guides self-contained: relative links must resolve to
 * files inside the package, heading fragments must exist, and links into the
 * private monorepo (or the private PUBLISHING.md) are rejected. Other external
 * URLs and mailto links pass unchanged so CI never depends on the network.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const PUBLIC_REPO_LINK =
  /^https?:\/\/github\.com\/RanchBot\/mcp-server\/(?:blob|tree)\/[^/]+\/(.+)$/i;
const PRIVATE_REPO_LINK = /^https?:\/\/github\.com\/RanchBot\/app(?:\/|$)/i;
/** Files that exist only in the private source and must not be linked publicly. */
const PRIVATE_FILES = new Set(['PUBLISHING.md']);

/** Mask inline code spans on a single line without changing its length. */
function maskInlineCode(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '`') {
      let ticks = 0;
      while (line[i + ticks] === '`') ticks += 1;
      const close = line.indexOf('`'.repeat(ticks), i + ticks);
      if (close !== -1) {
        const end = close + ticks;
        out += ' '.repeat(end - i);
        i = end;
        continue;
      }
    }
    out += line[i];
    i += 1;
  }
  return out;
}

/** Remove fenced code blocks and inline code, preserving line count. */
export function maskCode(markdown) {
  return maskFencedCode(markdown, maskInlineCode);
}

/** Remove fenced code blocks only, preserving line count. */
export function maskFencedCode(markdown, lineTransform = (line) => line) {
  let fence = null;
  return String(markdown)
    .split('\n')
    .map((line) => {
      const match = FENCE.exec(line);
      if (fence) {
        if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
        return '';
      }
      if (match) {
        fence = match[1];
        return '';
      }
      return lineTransform(line);
    })
    .join('\n');
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Extract inline Markdown links (and images) from a document. Fenced code
 * blocks and inline code are ignored. Each result keeps its 1-based line so a
 * failure names the exact location.
 */
export function extractMarkdownLinks(markdown) {
  const text = maskCode(markdown);
  const links = [];
  const opener = /\[([^\]]*)\]\(/g;
  let match;
  while ((match = opener.exec(text)) !== null) {
    let i = opener.lastIndex;
    let depth = 1;
    let raw = '';
    for (; i < text.length; i += 1) {
      const character = text[i];
      if (character === '\\' && i + 1 < text.length) {
        raw += text[i + 1];
        i += 1;
        continue;
      }
      if (character === '(') depth += 1;
      else if (character === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
      raw += character;
    }
    if (depth !== 0) break;
    let target = raw.trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1);
    } else {
      const titled = /^(\S+)[ \t]+["'(].*$/s.exec(target);
      if (titled) target = titled[1];
    }
    links.push({ line: lineAt(text, match.index), label: match[1], target });
    opener.lastIndex = i + 1;
  }
  return links;
}

/** GitHub-style heading slug. */
export function slugifyHeading(text) {
  return String(text)
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Every heading anchor a document defines, including GitHub's duplicate suffixes. */
export function headingAnchors(markdown) {
  const anchors = new Set();
  const seen = new Map();
  for (const line of maskFencedCode(markdown).split('\n')) {
    const match = ATX_HEADING.exec(line);
    if (!match) continue;
    const slug = slugifyHeading(match[2]);
    if (!slug) continue;
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

/** Classify a link target without touching the network. */
export function classifyLinkTarget(target) {
  const trimmed = String(target ?? '').trim();
  if (trimmed === '') return { kind: 'empty' };
  if (trimmed.startsWith('#')) return { kind: 'anchor', fragment: trimmed.slice(1) };
  if (/^mailto:/i.test(trimmed)) return { kind: 'mail' };
  if (PRIVATE_REPO_LINK.test(trimmed)) return { kind: 'private' };
  const mapped = PUBLIC_REPO_LINK.exec(trimmed);
  if (mapped) return { kind: 'internal', path: mapped[1] };
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) {
    return { kind: 'external' };
  }
  return { kind: 'relative' };
}

/** Split a relative target into a percent-decoded path and a fragment. */
export function splitTarget(target) {
  const text = String(target);
  const hash = text.indexOf('#');
  const fragment = hash === -1 ? '' : text.slice(hash + 1);
  const withoutFragment = hash === -1 ? text : text.slice(0, hash);
  const path = withoutFragment.split('?')[0];
  return { path: decodeURIComponent(path), fragment };
}

/**
 * Resolve a link target to a package-relative path. Returns `{ error }` when a
 * path is absolute or escapes the package root, which covers the private
 * monorepo (`../docs/...`) and private issue evidence.
 */
export function resolveRelativeTarget({ documentPath, target }) {
  const { path, fragment } = splitTarget(target);
  if (path === '') return { path: documentPath, fragment };
  if (path.startsWith('/')) return { error: `absolute path ${JSON.stringify(target)}` };
  const base = documentPath.includes('/')
    ? documentPath.slice(0, documentPath.lastIndexOf('/'))
    : '';
  const resolved = base ? `${base}/${path}` : path;
  const normalized = normalizePosix(resolved);
  if (normalized.startsWith('..') || normalized.startsWith('/')) {
    return { error: `path escapes the package: ${JSON.stringify(target)}` };
  }
  return { path: normalized, fragment };
}

/** Normalize a POSIX path without importing `node:path` (kept tiny + testable). */
function normalizePosix(input) {
  const segments = [];
  for (const segment of String(input).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0 || segments[segments.length - 1] === '..') segments.push('..');
      else segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function problem(link, message) {
  return `${link.line}: ${message} (${JSON.stringify(link.target)})`;
}

/**
 * Analyze one document's links against a package-relative file view. Returns a
 * list of human-readable problems; an empty list passes.
 */
export function analyzeDocumentLinks({ documentPath, text, exists, readText }) {
  const problems = [];
  const anchorCache = new Map();
  const anchorsFor = (path) => {
    if (!anchorCache.has(path)) anchorCache.set(path, headingAnchors(readText(path)));
    return anchorCache.get(path);
  };

  for (const link of extractMarkdownLinks(text)) {
    const classification = classifyLinkTarget(link.target);
    if (classification.kind === 'empty') {
      problems.push(problem(link, 'empty link target'));
      continue;
    }
    if (classification.kind === 'external' || classification.kind === 'mail') continue;
    if (classification.kind === 'private') {
      problems.push(problem(link, 'links into the private monorepo'));
      continue;
    }

    let resolved;
    if (classification.kind === 'anchor') {
      resolved = { path: documentPath, fragment: classification.fragment };
    } else if (classification.kind === 'internal') {
      const split = splitTarget(classification.path);
      const normalized = normalizePosix(split.path);
      if (normalized.startsWith('..') || normalized.startsWith('/')) {
        problems.push(problem(link, `path escapes the package: ${JSON.stringify(link.target)}`));
        continue;
      }
      resolved = { path: normalized, fragment: split.fragment };
    } else {
      resolved = resolveRelativeTarget({ documentPath, target: link.target });
      if (resolved.error) {
        problems.push(problem(link, resolved.error));
        continue;
      }
    }

    if (PRIVATE_FILES.has(resolved.path.split('/').pop())) {
      problems.push(problem(link, 'links to the private publishing document'));
      continue;
    }
    if (!exists(resolved.path)) {
      problems.push(problem(link, `missing target ${JSON.stringify(resolved.path)}`));
      continue;
    }
    if (resolved.fragment && !anchorsFor(resolved.path).has(resolved.fragment)) {
      problems.push(
        problem(
          link,
          `missing heading ${JSON.stringify(`#${resolved.fragment}`)} in ${resolved.path}`,
        ),
      );
    }
  }
  return problems;
}

/** Fail closed when the package's public documentation is missing or has bad links. */
export function assertPublicDocumentLinks({ root, documents, readText, exists }) {
  const read = readText ?? ((path) => requireText(root, path));
  const present = exists ?? ((path) => fileExists(root, path));
  const problems = [];
  for (const documentPath of documents) {
    if (!present(documentPath)) {
      problems.push(`${documentPath}: document is missing`);
      continue;
    }
    let text;
    try {
      text = read(documentPath);
    } catch (error) {
      problems.push(`${documentPath}: ${error.message}`);
      continue;
    }
    problems.push(...analyzeDocumentLinks({ documentPath, text, exists: present, readText: read }));
  }
  if (problems.length) {
    throw new Error(`Public documentation link check failed:\n- ${problems.join('\n- ')}`);
  }
  return documents.length;
}

function fileExists(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function requireText(root, relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

/** Assert every required document exists in the given package-relative view. */
export function assertRequiredDocumentsPresent({ required, exists, label = 'package' }) {
  const present = exists ?? ((path) => existsSync(path));
  const missing = required.filter((document) => !present(document));
  if (missing.length) {
    throw new Error(`${label} is missing required documentation: ${missing.join(', ')}`);
  }
  return required;
}

/** Assert the release tarball contains every required document. */
export function assertTarballCoversDocuments({ paths, requiredDocuments }) {
  const set = new Set(paths);
  const missing = requiredDocuments.filter((document) => !set.has(document));
  if (missing.length) {
    throw new Error(`Release tarball is missing required documentation: ${missing.join(', ')}`);
  }
  return requiredDocuments;
}

/** Parse the explicit `git archive` allowlist from PUBLISHING.md. */
export function parseGitArchiveAllowlist(publishingText) {
  const lines = String(publishingText).split('\n');
  const start = lines.findIndex((line) => line.includes('git archive'));
  if (start === -1) throw new Error('PUBLISHING.md does not document a git archive export');
  const entries = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const tarIndex = line.indexOf('| tar');
    const relevant = tarIndex === -1 ? line : line.slice(0, tarIndex);
    const trimmed = relevant.trim();
    if (trimmed) {
      for (const token of trimmed
        .replace(/\\\s*$/, '')
        .trim()
        .split(/\s+/)) {
        if (token) entries.push(token);
      }
    }
    if (tarIndex !== -1) break;
    if (!line.trimEnd().endsWith('\\')) break;
  }
  return entries;
}

/** True when the export allowlist covers a package-relative document. */
export function exportCoversDocument({ allowlist, document, prefix = 'mcp-server/' }) {
  const full = `${prefix}${document}`;
  return allowlist.some(
    (entry) => entry === full || full.startsWith(`${entry.replace(/\/+$/, '')}/`),
  );
}

/** Assert the source-export allowlist covers every required document. */
export function assertExportCoversDocuments({
  allowlist,
  requiredDocuments,
  prefix = 'mcp-server/',
}) {
  const missing = requiredDocuments.filter(
    (document) => !exportCoversDocument({ allowlist, document, prefix }),
  );
  if (missing.length) {
    throw new Error(
      `Source export allowlist is missing required documentation: ${missing.join(', ')}`,
    );
  }
  return requiredDocuments;
}
