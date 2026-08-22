import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  classifyProvisioningFailure, isRetryable, retryDelayMs,
  MAX_STEP_ATTEMPTS, RETRY_BACKOFF_MS,
} from '@/lib/provisioning-retry'

// ============================================================================
// One click, and then wait.
//
// Provisioning ran ten steps, threw on the first failure, and marked the whole
// business PROVISIONING_FAILED. There was no retry, so a dropped socket ended
// the run; and no resume, so the next click started again from step one. The
// Super Admin became the retry loop, clicking a button labelled "Provision
// Again" until the transient thing stopped happening.
//
// The steps were always idempotent — that is why the clicking eventually
// worked, and also why nobody noticed the pipeline could not recover on its
// own.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const ENGINE = read('src/lib/business-provisioning.ts')
const ROUTE  = read('src/app/api/admin/businesses/provision/route.ts')
const WIZARD = read('src/components/admin/businesses/business-management-wizard.tsx')

describe('transient failures are retried, permanent ones are not', () => {
  it('the network and a busy database are worth another attempt', () => {
    for (const m of [
      'connect ETIMEDOUT 10.0.0.1:443',
      'socket hang up',
      'fetch failed',
      'ECONNRESET',
      'Service temporarily unavailable',
      'Upstream returned 503',
      'SQLITE_BUSY: database is locked',
      'deadlock detected',
      'request timed out',
    ]) {
      expect(classifyProvisioningFailure(new Error(m))).toBe('TRANSIENT')
    }
  })

  it('configuration mistakes are not', () => {
    for (const m of [
      'Product LAUNDRY not found',
      'Product LAUNDRY is not active',
      'Subscription plan not found',
      'Business product assignment incomplete',
      'No features assigned from subscription plan',
      'Unique constraint failed on the fields: (`email`)',
      'Owner email is invalid',
    ]) {
      expect(classifyProvisioningFailure(new Error(m))).toBe('PERMANENT')
    }
  })

  it('a permanent message wins even when it reads like a transient one', () => {
    // "not found … try again later" must not buy three attempts at nothing.
    expect(classifyProvisioningFailure(new Error('Plan not found, try again later'))).toBe('PERMANENT')
  })

  it('an aborted request is a timeout by another name', () => {
    const e = new Error('The operation was aborted')
    e.name = 'AbortError'
    expect(classifyProvisioningFailure(e)).toBe('TRANSIENT')
  })

  it('an unrecognised failure is not retried', () => {
    // Retrying something we cannot characterise buys a slower path to the same
    // error; the admin sees the real message sooner this way.
    expect(classifyProvisioningFailure(new Error('something odd happened'))).toBe('PERMANENT')
    expect(isRetryable('a bare string')).toBe(false)
  })

  it('the retry budget stays inside a request a person is waiting on', () => {
    expect(MAX_STEP_ATTEMPTS).toBe(3)
    const total = RETRY_BACKOFF_MS.reduce((a, b) => a + b, 0)
    expect(total).toBeLessThanOrEqual(6000)
    expect(retryDelayMs(1)).toBe(500)
    expect(retryDelayMs(2)).toBe(1500)
    // Past the table, the last delay stands rather than undefined.
    expect(retryDelayMs(99)).toBe(1500)
  })
})

describe('the engine retries in place instead of failing the run', () => {
  it('a step is attempted again when the failure is retryable', () => {
    expect(ENGINE).toContain('const retriable = isRetryable(error) && attempts < MAX_STEP_ATTEMPTS')
    expect(ENGINE).toContain('await sleep(retryDelayMs(attempts))')
  })

  it('a retried attempt is still written to the audit log', () => {
    // Otherwise the log claims a clean run over a step that failed twice.
    expect(ENGINE).toContain('(attempt ${attempts}, retrying)')
  })

  it('the run reports how many attempts each step took', () => {
    expect(ENGINE).toContain("steps.push({ name: step.name, status: 'COMPLETED', duration, attempts })")
  })

  it('a permanent failure stops immediately', () => {
    expect(ENGINE).toContain('failureKind = classifyProvisioningFailure(error)')
    expect(ENGINE).toContain('failedStep = step.name')
  })
})

describe('a resumed run does not redo what already finished', () => {
  it('completed steps are read from the audit log', () => {
    expect(ENGINE).toContain('async function completedStepNames(workspaceId: string)')
    expect(ENGINE).toContain("where: { workspaceId, status: 'COMPLETED' }")
  })

  it('only steps that opt in are skipped', () => {
    expect(ENGINE).toContain('if (step.skipOnResume && alreadyDone.has(step.name))')
    expect(ENGINE).toContain("steps.push({ name: step.name, status: 'SKIPPED', duration: 0, attempts: 0 })")
  })

  it('the expensive steps are the ones that opt in', () => {
    const owner = ENGINE.slice(ENGINE.indexOf("name: 'create_owner_account'"), ENGINE.indexOf("name: 'assign_licensed_features'"))
    const product = ENGINE.slice(ENGINE.indexOf("name: 'call_product_provisioner'"), ENGINE.indexOf("name: 'generate_website_config'"))
    expect(owner).toContain('skipOnResume: true')
    expect(product).toContain('skipOnResume: true')
  })

  it('steps that read current configuration always run again', () => {
    // An admin who fixed a plan and pressed Provision again must not be served
    // the storage allocation computed from the old one.
    for (const name of ['validate_product', 'validate_subscription_plan', 'assign_licensed_features', 'allocate_storage', 'generate_workspace_config']) {
      const block = ENGINE.slice(ENGINE.indexOf(`name: '${name}'`), ENGINE.indexOf(`name: '${name}'`) + 260)
      expect(block).not.toContain('skipOnResume')
    }
  })

  it('a workspace that already completed runs whole', () => {
    // Re-provisioning a live tenant is deliberate, not a recovery.
    expect(ENGINE).toContain("const wasCompletedBefore = workspace?.provisioningStatus === 'COMPLETED'")
    expect(ENGINE).toContain('const alreadyDone = wasCompletedBefore\n      ? new Set<string>()\n      : await completedStepNames(workspace.id)')
  })

  it('that flag is read before the row is flipped to IN_PROGRESS', () => {
    // Read afterwards it is always false, and resume never engages.
    const flag = ENGINE.indexOf('const wasCompletedBefore')
    const flip = ENGINE.indexOf("provisioningStatus: 'IN_PROGRESS'")
    expect(flag).toBeGreaterThan(-1)
    expect(flag).toBeLessThan(flip)
  })
})

describe('every step is safe to run twice', () => {
  it('the owner account is upserted, never duplicated', () => {
    expect(ENGINE).toContain('await db.businessUser.upsert({')
    expect(ENGINE).toContain('const existingOwner = await db.businessUser.findFirst({')
  })

  it('the workspace is found before it is created', () => {
    expect(ENGINE).toContain('let workspace = await db.platformWorkspace.findUnique({')
    expect(ENGINE).toContain('if (!workspace) {')
  })

  it('configuration steps update the workspace rather than inserting', () => {
    for (const marker of ['websiteConfig: JSON.stringify(websiteConfig)', 'workspaceConfig: JSON.stringify(workspaceConfig)', 'storageAllocatedMB: effectiveStorageMB']) {
      expect(ENGINE).toContain(marker)
    }
    expect(ENGINE).not.toContain('db.platformWorkspace.createMany')
  })
})

describe('the button cannot be the retry loop', () => {
  it('it is disabled for the whole run', () => {
    expect(WIZARD).toContain('disabled={prov.running || saving || !biz?.productCode || !biz?.subscriptionPlanCode}')
  })

  it('"Provision Again" is gone', () => {
    expect(WIZARD).not.toContain("'Provision Again'")
  })

  it('the three states are named', () => {
    expect(WIZARD).toContain("'Provisioning Workspace…'")
    expect(WIZARD).toContain("'Workspace Ready ✓'")
    expect(WIZARD).toContain("'Retry Provisioning'")
    expect(WIZARD).toContain('Action Required')
  })

  it('progress is shown while it runs', () => {
    expect(WIZARD).toContain('Step {Math.min(prov.done + 1, prov.total)} of {prov.total}')
    expect(WIZARD).toContain('stepLabel(prov.current)')
  })

  it('progress comes from the audit log, not from a guess', () => {
    expect(WIZARD).toContain('/api/admin/businesses/provision?businessId=')
    expect(WIZARD).toContain("x.status === 'COMPLETED'")
    expect(WIZARD).toContain('clearInterval(poll)')
  })

  it('a missed poll is not treated as a failure', () => {
    expect(WIZARD).toContain('/* a missed poll is not a failed provision */')
  })

  it('Open Workspace appears once it is ready', () => {
    expect(WIZARD).toContain('Open Workspace')
    expect(WIZARD).toContain("prov.outcome === 'READY' || biz?.status === 'ACTIVE'")
  })

  it('Retry is offered only for a failure a person can act on', () => {
    // Transient failures never reach the UI — they were retried inside the run.
    expect(WIZARD).toContain("outcome: 'ACTION_REQUIRED'")
    expect(WIZARD).toContain('failedStep: json.data?.failedStep')
  })
})

describe('the API tells the UI what kind of failure it was', () => {
  it('the classification and the failing step are passed through', () => {
    expect(ROUTE).toContain('failureKind: result.failureKind')
    expect(ROUTE).toContain('failedStep: result.failedStep')
    expect(ROUTE).toContain('stepsTotal: result.stepsTotal')
  })
})
