/**
 * Why a game could not start. The interface translates these; `detail`
 * holds the technical part (path, exit code, system message), never a sentence
 * meant for the tester.
 */
export type FailReason =
  | 'invalid-session' // the id is not a session id
  | 'not-prepared' // no valid session.lock.json
  | 'missing-files' // files: what is missing; nothing is started
  | 'executable-not-found' // detail: the executable
  | 'executable-denied' // detail: the executable
  | 'spawn-error' // detail: the system message
  | 'data-conversion'; // detail: PSDK exit code

/** Plain-language meaning of an exit code, translated by the interface. */
export type ExitHint =
  | 'dll-not-found'
  | 'dll-wrong-version'
  | 'dll-bad-image'
  | 'access-violation'
  | 'not-found';

/**
 * How a launch ended. `closed` only means the game started and was closed
 * without error: it says nothing about whether the MR works.
 */
export type GameEnd =
  | { kind: 'closed'; log: string }
  | {
      kind: 'crashed';
      /** 'startup': exited before its window was up; 'game': while running. */
      during: 'startup' | 'game';
      code: number | null;
      signal: string | null;
      hint: ExitHint | null;
      output: string; // last lines the game printed, ANSI colors removed
      log: string;
    }
  | {
      kind: 'failed';
      reason: FailReason;
      detail?: string;
      files?: string[];
      log?: string;
    }
  | { kind: 'stopped'; log: string }; // stopped by PSDK Lab (AbortSignal)

/**
 * starting: process created, PSDK converting data or booting (no window yet).
 * running: PSDK reported its graphics are up.
 */
export type GameState =
  | { kind: 'starting' }
  | { kind: 'running'; pid: number }
  | GameEnd;

// Windows NTSTATUS exit codes a missing or broken dependency produces.
const WINDOWS_CODES: Record<number, ExitHint> = {
  0xc0000135: 'dll-not-found', // STATUS_DLL_NOT_FOUND
  0xc0000139: 'dll-wrong-version', // STATUS_ENTRYPOINT_NOT_FOUND
  0xc000007b: 'dll-bad-image', // STATUS_INVALID_IMAGE_FORMAT
  0xc0000005: 'access-violation', // STATUS_ACCESS_VIOLATION
};

/** What an exit code means, when it says more than "error". */
export function exitHint(
  code: number | null,
  platform = process.platform,
): ExitHint | null {
  if (code === null) return null;
  if (platform === 'win32') return WINDOWS_CODES[code >>> 0] ?? null;
  return code === 127 ? 'not-found' : null;
}

/** One line for game.log (read by developers, kept in English). */
export function endSummary(end: GameEnd): string {
  switch (end.kind) {
    case 'closed':
      return 'game closed (exit 0)';
    case 'crashed':
      return (
        `game exited with an error during ${end.during} ` +
        `(code ${end.code}, signal ${end.signal})` +
        (end.hint ? `: ${end.hint}` : '')
      );
    case 'failed':
      return (
        `game could not start: ${end.reason}` +
        (end.detail ? ` (${end.detail})` : '') +
        (end.files ? `\n${end.files.join('\n')}` : '')
      );
    case 'stopped':
      return 'game stopped by PSDK Lab';
  }
}
