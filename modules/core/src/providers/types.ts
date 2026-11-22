// Models the interface works with, whatever the Git host. Each provider
// (gitlab/ for now) maps its API answers to these types.

/** An account on the Git host. */
export interface ProviderUser {
  id: string; // stable id from the host (usernames can change)
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string;
}

/** A comment of a discussion. */
export interface DiscussionNote {
  id: string;
  body: string; // Markdown
  author: ProviderUser;
  createdAt: string; // ISO date
  updatedAt: string;
  /** Comment on a line of the changes, shown with its file. */
  onCode: { path: string; line: number | null } | null;
}

/** A thread (or a single comment) on a merge request. */
export interface Discussion {
  id: string;
  notes: DiscussionNote[];
  resolvable: boolean;
  resolved: boolean;
}

/** What the host allows the current visitor to do: the interface never assumes an operation exists. */
export interface ProviderCapabilities {
  readDiscussions: boolean;
  comment: boolean;
  reply: boolean;
}

/** OAuth tokens. Stay in the main process: the interface never receives them. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
  scope: string;
}
