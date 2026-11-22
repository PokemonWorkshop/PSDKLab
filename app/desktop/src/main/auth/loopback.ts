import { createServer } from 'node:http';

export interface OAuthCallback {
  code: string;
  state: string;
}

const TIMEOUT_MS = 5 * 60 * 1000;

/** Local server for the GitLab callback, open only during the sign-in. */
export function waitForCallback(
  redirectUri: string,
  signal: AbortSignal,
  page: (ok: boolean) => string,
): Promise<OAuthCallback> {
  const target = new URL(redirectUri);
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', target);
      if (url.pathname !== target.pathname) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(page(Boolean(code)));
      if (code && state) finish(null, { code, state });
      else finish(new Error(url.searchParams.get('error') ?? 'access_denied'));
    });

    const onAbort = () => finish(new Error('cancelled'));
    const timer = setTimeout(() => finish(new Error('timeout')), TIMEOUT_MS);
    function finish(err: Error | null, result?: OAuthCallback) {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      server.close();
      if (err) reject(err);
      else resolve(result!);
    }

    signal.addEventListener('abort', onAbort);
    server.on('error', (err: NodeJS.ErrnoException) =>
      finish(
        err.code === 'EADDRINUSE'
          ? new Error(`port-in-use:${target.port}`)
          : err,
      ),
    );
    server.listen(Number(target.port), target.hostname);
  });
}
