## 18. Deployment Pipeline

**Trigger:** Push to `main` branch (or manual dispatch)

**Steps:**
1. Checkout code on GitHub Actions runner
2. SSH into Hostinger VPS
3. Back up SQLite database (`/home/ubuntu/data/custom.db`) to `/home/ubuntu/backups/`
4. `git reset --hard origin/main`
5. `npm install --legacy-peer-deps`
6. `npx prisma generate && npx prisma db push`
7. `node scripts/ensure-super-admin.js` — idempotent super admin bootstrap
8. `npm run build` (Next.js standalone build)
9. Copy static assets into `.next/standalone/`
10. PM2 restart with `--update-env`
11. Health check (`curl localhost:3000`)

**Secrets required:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`

---