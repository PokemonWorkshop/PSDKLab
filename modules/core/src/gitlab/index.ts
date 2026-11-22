export interface MergeRequest {
  iid: number;
  /** Numeric project id: GitLab serves uploads under /-/project/<id>/uploads/. */
  projectId?: number;
  title: string;
  author: string;
  sourceBranch: string;
  sha: string;
  webUrl: string;
  updatedAt: string;
  labels: string[];
  description: string; // Markdown written by the author (test instructions…)
}

interface GitlabMr {
  iid: number;
  project_id?: number;
  title: string;
  author: { username: string };
  source_branch: string;
  sha: string;
  web_url: string;
  updated_at: string;
  labels?: string[];
  description?: string | null;
  draft?: boolean;
  work_in_progress?: boolean; // older name of draft
}

import { PSDK_PROJECT } from '../constants';
import { gitlabJson, projectPath } from './client';
export { PSDK_PROJECT, TEST_LABEL } from '../constants';
export { GitlabError } from './client';

/** Open MRs without the Draft ones (not ready to be tested). */
export function toMergeRequests(raw: GitlabMr[]): MergeRequest[] {
  return raw
    .filter((mr) => !(mr.draft ?? mr.work_in_progress ?? false))
    .map((mr) => ({
      iid: mr.iid,
      projectId: mr.project_id,
      title: mr.title,
      author: mr.author.username,
      sourceBranch: mr.source_branch,
      sha: mr.sha,
      webUrl: mr.web_url,
      updatedAt: mr.updated_at,
      labels: mr.labels ?? [],
      description: mr.description ?? '',
    }));
}

export async function listMergeRequests(
  project: string = PSDK_PROJECT,
  fetchFn: typeof fetch = fetch,
  token?: string | null,
): Promise<MergeRequest[]> {
  const { data } = await gitlabJson<GitlabMr[]>(
    `${projectPath(project)}/merge_requests?state=opened&per_page=50`,
    { token, fetchFn },
  );
  return toMergeRequests(data);
}
