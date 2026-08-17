import type { AxeViolation } from '../types.js';
import { getFile, type RepoOctokit } from '../github.js';

const CANDIDATE_EXTENSIONS = ['.html', '.htm', '.svelte', '.vue', '.astro'];
const MAX_CANDIDATE_FILES = 30;

interface TreeEntry {
  path?: string;
  type?: string;
}

/** List repo files (recursive) filtered to template-like candidates. */
export async function listCandidateFiles(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<string[]> {
  const { data } = await octokit.rest.git.getTree({ owner, repo, tree_sha: ref, recursive: 'true' });
  return (data.tree as TreeEntry[])
    .filter((e) => e.type === 'blob' && CANDIDATE_EXTENSIONS.some((ext) => e.path?.endsWith(ext)))
    .map((e) => e.path as string)
    .slice(0, MAX_CANDIDATE_FILES);
}

/**
 * Map violations to the source files that contain their HTML excerpt.
 * A file is in scope for a violation when it contains the violation's
 * element snippet (or selector attribute value) verbatim.
 */
export async function locateViolationFiles(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  ref: string,
  violations: AxeViolation[],
): Promise<Map<string, { content: string; violations: AxeViolation[] }>> {
  const candidates = await listCandidateFiles(octokit, owner, repo, ref);
  const byFile = new Map<string, { content: string; violations: AxeViolation[] }>();

  const fileCache = new Map<string, string | null>();
  for (const path of candidates) {
    const file = await getFile(octokit, owner, repo, path, ref);
    fileCache.set(path, file?.content ?? null);
  }

  for (const v of violations) {
    const probes = buildProbes(v);
    if (probes.length === 0) continue;
    for (const [path, content] of fileCache) {
      if (content === null) continue;
      if (probes.some((p) => content.includes(p))) {
        const entry = byFile.get(path) ?? { content, violations: [] };
        entry.violations.push(v);
        byFile.set(path, entry);
      }
    }
  }
  return byFile;
}

/** Extract stable substring probes from a violation's element snippet. */
export function buildProbes(v: AxeViolation): string[] {
  const probes: string[] = [];
  if (v.html) {
    const openTag = v.html.match(/^<([a-zA-Z][a-zA-Z0-9-]*)([^>]{0,120})/);
    if (openTag?.[0] && openTag[0].length >= 12) probes.push(openTag[0]);
  }
  const attrFromTarget = v.target.match(/\[([a-zA-Z-]+)="([^"]{6,})"\]/);
  if (attrFromTarget) {
    probes.push(`${attrFromTarget[1]}="${attrFromTarget[2]}"`);
  }
  return probes;
}
