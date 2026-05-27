// Resolves the persistent upload directory for the current environment.
//
// In production (UPLOAD_ROOT=/var/www/uploads) files live outside the project
// entirely and survive npm run build / pm2 restart.
//
// In development (no env var) it falls back to <cwd>/public/uploads so local
// dev still works with zero configuration.
import { resolve, join } from 'path'
import { mkdir } from 'fs/promises'

export const UPLOAD_ROOT: string = process.env.UPLOAD_ROOT
  ? resolve(process.env.UPLOAD_ROOT)
  : resolve(join(process.cwd(), 'public', 'uploads'))

/** Create a directory under UPLOAD_ROOT if it does not already exist. */
export async function ensureDir(subPath: string): Promise<string> {
  const dir = join(UPLOAD_ROOT, subPath)
  await mkdir(dir, { recursive: true })
  return dir
}
