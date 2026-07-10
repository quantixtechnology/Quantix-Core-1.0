// GET /api/health/readiness — deployment readiness probe.
//
// Unlike GET / or the product health endpoints (which return 200 even when the
// database layer is broken), this proves the full runtime is serviceable:
//   • the application process is running (this handler executes)
//   • the Prisma client module loads (importing db.ts)
//   • the SQLite database is reachable and a real query executes
//   • a critical table can be queried
//
// Used by deploy-local.sh to validate a candidate release BEFORE the atomic
// switch, and to validate production AFTER the switch. A non-2xx response must
// abort/rollback the deploy.
//
// Security: exposes NO business data, NO database path, NO secrets, NO records —
// only boolean readiness flags. It performs a read-only count; it never mutates.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const result = { status: "ready", app: true, prisma: false, database: false }
  try {
    // Proves: Prisma client loaded + DB connection + query execution + the
    // critical Business table is queryable. COUNT returns a number only.
    await db.$queryRaw`SELECT 1`
    result.prisma = true
    await db.business.count()
    result.database = true
    return NextResponse.json(result, { status: 200 })
  } catch {
    // Do not leak the error detail (could contain the DB path). Flags only.
    return NextResponse.json({ ...result, status: "not-ready" }, { status: 503 })
  }
}
