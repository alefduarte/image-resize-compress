import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const fixturesDir = fileURLToPath(new URL('./tests/fixtures', import.meta.url));

const EXTENSION_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serves test fixtures and synthetic HTTP responses to the browser tier so
 * `fromURL`/`urlToBlob` can be exercised end-to-end against the Vitest server:
 *   GET /fixtures/<name>   → the committed fixture file with a real image mime
 *   GET /__test__/404      → 404 (FetchError status test)
 *   GET /__test__/html     → 200 text/html (non-image InvalidImageError test)
 */
const fixtureServer = (): Plugin => ({
  name: 'serve-test-fixtures',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];

      if (url.startsWith('/__test__/404')) {
        res.statusCode = 404;
        res.statusMessage = 'Not Found';
        res.end('Not Found');
        return;
      }

      if (url.startsWith('/__test__/html')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          '<!doctype html><title>error page</title><h1>Not an image</h1>',
        );
        return;
      }

      if (url.startsWith('/fixtures/')) {
        const name = decodeURIComponent(url.slice('/fixtures/'.length));
        const filePath = path.join(fixturesDir, name);
        // Reject path traversal outside the fixtures directory. `path.relative`
        // enforces a segment boundary, so a sibling like `../fixtures2` (which
        // shares the `fixtures` prefix) is not mistaken for a child.
        const rel = path.relative(
          path.resolve(fixturesDir),
          path.resolve(filePath),
        );
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        readFile(filePath).then(
          (data) => {
            res.statusCode = 200;
            res.setHeader(
              'Content-Type',
              EXTENSION_MIME[path.extname(name)] ?? 'application/octet-stream',
            );
            res.end(data);
          },
          () => {
            res.statusCode = 404;
            res.end('Not Found');
          },
        );
        return;
      }

      next();
    });
  },
});

export default defineConfig({
  plugins: [fixtureServer()],
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        plugins: [fixtureServer()],
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            // Pin to an allowed IPv4 port: Vite only retries auto-port on
            // EADDRINUSE, not EACCES, so a random port landing in a Windows
            // reserved range (Hyper-V/WSL) hard-fails. Inert on CI/Linux.
            api: { port: 51890, host: '127.0.0.1' },
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // worker-entry.ts only ever runs inside a Worker, on a stringified copy
      // the page-context instrumenter never sees — it is uninstrumentable here.
      exclude: ['src/**/*.unit.test.ts', 'src/types.ts', 'src/worker-entry.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
