import type {
  Discussion,
  DiscussionNote,
  ProviderUser,
} from '../providers/types';

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  web_url: string;
}

interface GitlabNote {
  id: number;
  body: string;
  author: GitlabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  position?: { new_path?: string; new_line?: number | null } | null;
}

export interface GitlabDiscussion {
  id: string;
  notes: GitlabNote[];
}

/** GitLab gives relative avatar paths for uploaded avatars. */
function avatar(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `https://gitlab.com${url}` : url;
}

export function toUser(u: GitlabUser): ProviderUser {
  return {
    id: String(u.id),
    username: u.username,
    name: u.name,
    avatarUrl: avatar(u.avatar_url),
    webUrl: u.web_url,
  };
}

function toNote(n: GitlabNote): DiscussionNote {
  const path = n.position?.new_path;
  return {
    id: String(n.id),
    body: n.body,
    author: toUser(n.author),
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    onCode: path ? { path, line: n.position?.new_line ?? null } : null,
  };
}

interface ResolvableNote extends GitlabNote {
  resolvable?: boolean;
  resolved?: boolean;
}

/** People's comments only, system notes are left out. */
export function toDiscussions(raw: GitlabDiscussion[]): Discussion[] {
  return raw
    .map((d) => {
      const notes = d.notes as ResolvableNote[];
      const people = notes.filter((n) => !n.system);
      const resolvable = people.some((n) => n.resolvable);
      return {
        id: d.id,
        notes: people.map(toNote),
        resolvable,
        resolved: resolvable && people.every((n) => !n.resolvable || n.resolved),
      };
    })
    .filter((d) => d.notes.length > 0);
}
