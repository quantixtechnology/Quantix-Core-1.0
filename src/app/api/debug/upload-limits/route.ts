// ============================================================================
// GET /api/debug/upload-limits
// Returns upload configuration for every layer in the stack so you can
// identify which proxy is responsible for a 413 error.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { UPLOAD_ROOT } from '@/lib/upload-root';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import os from 'os';

export async function GET(req: NextRequest) {
  // Test: can the server write a small file to UPLOAD_ROOT?
  const testPath = join(UPLOAD_ROOT, '_limit_test_' + Date.now() + '.txt');
  let writeTest: { ok: boolean; error?: string } = { ok: false };
  try {
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(testPath, 'ok');
    await unlink(testPath);
    writeTest = { ok: true };
  } catch (err) {
    writeTest = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Test: how big is the incoming request body (send a body to test)
  let requestBodySize: number | null = null;
  try {
    const cl = req.headers.get('content-length');
    requestBodySize = cl ? parseInt(cl, 10) : null;
  } catch { /* not critical */ }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uploadRoot: UPLOAD_ROOT,
    writeTest,
    nextjs: {
      // Next.js standalone server — no built-in body limit for Route Handlers
      // The experimental.serverActions.bodySizeLimit in next.config only
      // applies to Server Actions, not Route Handlers. Route Handlers read
      // request.formData() directly without a body parser limit.
      routeHandlerLimit: 'none (reads request.formData() directly)',
      serverActionLimit: '20mb (set in next.config.ts)',
    },
    caddy: {
      note: 'Caddy has no default body size limit. request_buffers 20MB is set in Caddyfile.',
      caddyfile: 'request_buffers 20MB, flush_interval -1',
    },
    nginx: {
      note: 'If nginx is running in front of Caddy (e.g. HestiaCP, system nginx), it has a default client_max_body_size of 1MB which WILL cause HTTP 413.',
      fix: 'Add "client_max_body_size 20m;" to the server{} or http{} block in /etc/nginx/nginx.conf or the site config, then run: nginx -t && systemctl reload nginx',
      checkCommand: 'nginx -T 2>/dev/null | grep -i client_max_body_size',
    },
    server: {
      platform:  os.platform(),
      nodeVersion: process.version,
      hostname:  os.hostname(),
      uptime:    Math.round(process.uptime()) + 's',
      incomingRequestBodySize: requestBodySize,
      headers: {
        host:            req.headers.get('host'),
        'x-forwarded-for': req.headers.get('x-forwarded-for'),
        'x-real-ip':     req.headers.get('x-real-ip'),
        via:             req.headers.get('via'),
        'x-forwarded-proto': req.headers.get('x-forwarded-proto'),
      },
    },
    instructions: [
      '1. Run on VPS: nginx -T 2>/dev/null | grep -i client_max_body_size',
      '2. If nginx is present: add client_max_body_size 20m; to the server{} block',
      '3. Reload nginx: nginx -t && systemctl reload nginx',
      '4. If no nginx: Caddy is the only proxy and 20MB is already configured via request_buffers',
      '5. Redeploy Next.js after next.config.ts change: pm2 restart quantix-core',
    ],
  });
}
