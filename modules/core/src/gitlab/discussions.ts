import { PSDK_PROJECT } from '../constants';
import type { Discussion, ProviderUser } from '../providers/types';
import { gitlabJson, projectPath, type GitlabRequest } from './client';
import {
  toDiscussions,
  toUser,
  type GitlabDiscussion,
  type GitlabUser,
} from './mappers';

type Auth = Pick<GitlabRequest, 'token' | 'fetchFn'>;

const MAX_PAGES = 10; // 1000 threads: more than any MR has

const mrPath = (project: string, iid: number) =>
  `${projectPath(project)}/merge_requests/${iid}`;

/** Threads of an MR, oldest first (readable without an account on a public project). */
export async function listDiscussions(
  iid: number,
  auth: Auth = {},
  project: string = PSDK_PROJECT,
): Promise<Discussion[]> {
  const all: GitlabDiscussion[] = [];
  let page = '1';
  for (let i = 0; i < MAX_PAGES && page; i++) {
    const { data, headers } = await gitlabJson<GitlabDiscussion[]>(
      `${mrPath(project, iid)}/discussions?per_page=100&page=${page}`,
      auth,
    );
    all.push(...data);
    page = headers.get('x-next-page') ?? '';
  }
  return toDiscussions(all);
}

/** Starts a new thread on the MR (needs a token with the api scope). */
export async function createDiscussion(
  iid: number,
  body: string,
  auth: Auth,
  project: string = PSDK_PROJECT,
): Promise<void> {
  await gitlabJson(`${mrPath(project, iid)}/discussions`, {
    ...auth,
    method: 'POST',
    body: { body },
  });
}

/** Answers in an existing thread (needs a token with the api scope). */
export async function replyToDiscussion(
  iid: number,
  discussionId: string,
  body: string,
  auth: Auth,
  project: string = PSDK_PROJECT,
): Promise<void> {
  const id = encodeURIComponent(discussionId);
  await gitlabJson(`${mrPath(project, iid)}/discussions/${id}/notes`, {
    ...auth,
    method: 'POST',
    body: { body },
  });
}

/** The account the token belongs to. */
export async function currentUser(auth: Auth): Promise<ProviderUser> {
  const { data } = await gitlabJson<GitlabUser>('/user', auth);
  return toUser(data);
}
