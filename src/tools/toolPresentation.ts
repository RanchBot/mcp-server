import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Presentation-only titles for the local stdio tool surface.
 *
 * Claude reviews a tool listing for a readable `annotations.title`; without one it falls back to
 * the raw snake_case identifier and flags the tool. This mirrors the hosted catalog's
 * {@link humanizeToolName} convention so both servers advertise the same readable names. It never
 * affects routing, schemas, handlers, or the hint values.
 */
export const humanizeToolName = (name: string): string => {
  const words = name.split('_').filter(Boolean);
  if (words.length === 0) return name;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest]
    .join(' ')
    .replace(/\beid\b/gi, 'EID');
};

/**
 * Resolve a tool's display name in precedence order:
 *   1. a nonblank curated top-level `title`;
 *   2. a nonblank annotation `title` that differs from the raw identifier;
 *   3. the humanized snake_case identifier (uppercase EID).
 */
export const readableToolTitle = (tool: Pick<Tool, 'name' | 'title' | 'annotations'>): string => {
  const curated = tool.title?.trim();
  if (curated) return curated;
  const annotated = tool.annotations?.title?.trim();
  if (annotated && annotated !== tool.name) return annotated;
  return humanizeToolName(tool.name);
};

/**
 * Return a copy of the tool whose top-level `title` and `annotations.title` both carry the readable
 * display name. All other fields and annotation hints are preserved, and the source object is
 * never mutated (generated CRUD definitions keep their raw annotation names).
 */
export const withReadableTitle = (tool: Tool): Tool => {
  const title = readableToolTitle(tool);
  return {
    ...tool,
    title,
    annotations: { ...(tool.annotations ?? {}), title },
  };
};
