/**
 * GitHub App client. Token permissions: contents:write + pull_requests:write +
 * checks:write. The App is NEVER granted merge permission — this is enforced
 * structurally at the App permission level (ADR 004).
 */

import { App } from '@octokit/app';
import type { Octokit } from '@octokit/rest';
import { config } from './config.js';

let app: App | null = null;

export function githubApp(): App {
  if (!app) {
    if (!config.github.appId || !config.github.privateKey) {
      throw new Error('GitHub App credentials not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY)');
    }
    app = new App({
      appId: config.github.appId,
      privateKey: config.github.privateKey,
    });
  }
  return app;
}

export type RepoOctokit = Octokit;

/** Short-lived installation-scoped client; never caches tokens. */
export async function getInstallationClient(installationId: number): Promise<RepoOctokit> {
  const octokit = await githubApp().getInstallationOctokit(installationId);
  return octokit as unknown as RepoOctokit;
}

export interface RemoteFile {
  path: string;
  content: string;
  sha: string;
}

export async function getFile(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<RemoteFile | null> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    const data = res.data as { content?: string; sha: string };
    if (typeof data.content !== 'string') return null;
    return {
      path,
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha: data.sha,
    };
  } catch {
    return null;
  }
}

/** Create branch `name` from `baseRef`; returns false when it already exists. */
export async function createBranch(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  name: string,
  baseRef: string,
): Promise<boolean> {
  const { data: ref } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${baseRef}` });
  try {
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${name}`, sha: ref.object.sha });
    return true;
  } catch (err) {
    if (String(err).includes('Reference already exists')) return false;
    throw err;
  }
}

/** Commit every patched file to the branch (create-or-update per file). */
export async function commitFiles(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string,
): Promise<void> {
  for (const file of files) {
    const existing = await getFile(octokit, owner, repo, file.path, branch);
    if (existing) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch,
        sha: existing.sha,
      });
    } else {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch,
      });
    }
  }
}

export interface PullRequestResult {
  number: number;
  htmlUrl: string;
}

export async function openPullRequest(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  params: { title: string; body: string; head: string; base: string },
): Promise<PullRequestResult> {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
  });
  return { number: data.number, htmlUrl: data.html_url };
}

export async function createCheckRun(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  params: {
    name: string;
    headSha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'skipped';
    title?: string;
    summary?: string;
  },
): Promise<void> {
  await octokit.rest.checks.create({
    owner,
    repo,
    name: params.name,
    head_sha: params.headSha,
    status: params.status,
    conclusion: params.conclusion,
    output: params.title
      ? { title: params.title, summary: params.summary ?? '' }
      : undefined,
  });
}

export async function getHeadSha(
  octokit: RepoOctokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<string> {
  const { data } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${ref}` });
  return data.object.sha;
}
