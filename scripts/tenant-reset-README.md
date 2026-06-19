Tenant Reset — Safe Tenant Data Deletion

Overview

This collection contains two scripts to safely remove tenant (business) operational data while preserving platform data.

Files

- scripts/tenant-reset.ts — Prisma TypeScript script (uses prisma client)
- scripts/tenant-reset-sqlite.sql — SQLite SQL script for direct DB access

Guidelines

- Always back up your database before running these scripts.
- Review the deletion lists; they are conservative but best-effort to cover tenant-scoped tables.
- The scripts delete data in a child-first order to avoid FK violations.

Prisma script usage

Install dependencies and run with Node (project already uses prisma client):

```bash
# example
BUSINESS_ID=cmp123 node scripts/tenant-reset.ts
```

SQLite SQL script usage

Edit the placeholder :BUSINESS_ID or use a simple sed substitution:

```bash
BUSINESS_ID=cmp123
sed "s/:BUSINESS_ID/${BUSINESS_ID}/g" scripts/tenant-reset-sqlite.sql | sqlite3 prisma/db/custom.db
```

Notes

- The following platform tables are preserved: `User`, `Lead`, `SalesTeamMember`, `PlatformPlan`, `PlatformConfig`, `RolePermission`, `WebsitePricingPlan`, `ProposalDocument`, `PlatformSettings`, `PlatformAuditLog`, and other admin/config tables.
- The scripts attempt to include all tenant-related tables referencing `Business`, `Store`, `Customer`, `Product`, `Inventory`, or `Order`.
- Some billing subsystems and cross-relations are best-effort and wrapped in try/catch in the Prisma script.
- Test on a copy of your DB first.
