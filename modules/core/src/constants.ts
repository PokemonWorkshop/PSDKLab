// Values the interface needs too. No Node import here: the renderer imports
// this module through "@psdk-lab/core/constants" (the main entry is Node-only).

/** GitLab project of Pokémon SDK. */
export const PSDK_PROJECT = 'pokemonsdk/pokemonsdk';

/** Label maintainers put on MRs ready to be tested. */
export const TEST_LABEL = 'Need to be tested';

/** Session folder of an MR head, ex. mr-101-7a4d9c2. */
export function sessionId(mrIid: number, sha: string): string {
  return `mr-${mrIid}-${sha.slice(0, 7)}`;
}
