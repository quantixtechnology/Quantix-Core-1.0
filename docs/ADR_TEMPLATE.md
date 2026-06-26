# Architecture Decision Record Template

**Use this template for every approved architectural change.**

---

# ADR-NNN: [Decision Title]

**Date:** YYYY-MM-DD  
**Status:** PROPOSED | APPROVED | IMPLEMENTED | DEPRECATED  
**Revision:** Master Context X.Y

---

## Context

### Problem Statement

What problem does this architectural decision solve?

Why is the current architecture insufficient?

What pain point does this address?

### Current State

How does the system currently work?

What are the limitations?

What constraints exist?

### Stakeholders

Who is affected by this decision?

- Platform teams
- Product teams
- Infrastructure
- Security
- Other

---

## Decision

### Proposed Architecture

What is the new architectural approach?

How will the system work after this change?

Provide diagrams or descriptions.

### Key Principles

What architectural principles does this uphold?

- Golden Rules compliance
- Platform Freeze alignment
- Product independence
- Registry patterns
- Other

### Implementation Approach

How will this be implemented?

What phases are required?

What is the timeline?

---

## Consequences

### Benefits

What improves with this change?

- **Benefit 1:** Description and impact
- **Benefit 2:** Description and impact
- **Benefit 3:** Description and impact

### Risks

What could go wrong?

- **Risk 1:** Description and mitigation
- **Risk 2:** Description and mitigation
- **Risk 3:** Description and mitigation

### Backward Compatibility

Is this a breaking change?

How will existing code be affected?

What is the migration path?

What is the deprecation timeline (if applicable)?

### Dependencies

Does this depend on other architectural decisions?

Does this enable future changes?

---

## Alternatives Considered

### Alternative 1: [Option Name]

**Description:** How this approach differs

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

**Why rejected:** Why this approach was not chosen

---

### Alternative 2: [Option Name]

**Description:** How this approach differs

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

**Why rejected:** Why this approach was not chosen

---

## Approval

**Proposed by:** [Name/Team]  
**Reviewed by:** [Name/Team]  
**Approved by:** [Name/Team]  
**Approval Date:** YYYY-MM-DD

---

## Implementation

**Implementation Epic:** [JIRA/GitHub Epic]  
**Related PRs:** [PR links]  
**Completion Date:** YYYY-MM-DD  
**Status:** NOT STARTED | IN PROGRESS | COMPLETE

---

## Related Decisions

**Links to related ADRs:**
- ADR-XXX: [Related decision title]
- ADR-YYY: [Related decision title]

---

## References

**Master Context Section:** [Section name and link]  
**Golden Rules:** [Rule numbers]  
**Implementation Details:** [Link to implementation docs]

---

## Change History

| Date | Status | Notes |
|------|--------|-------|
| YYYY-MM-DD | PROPOSED | Initial proposal |
| YYYY-MM-DD | APPROVED | Approved by [name] |
| YYYY-MM-DD | IMPLEMENTED | Completed in [version] |

---

## Examples

See implemented ADRs:
- ADR-001: Platform Controller Pattern
- ADR-002: Product Registry
- ADR-003: Runtime Registry
- ADR-004: Provisioning Engine
- ADR-005: Platform Freeze

---

**Template Version:** 1.0  
**Last Updated:** 2026-06-27  
**Repository:** QUANTIX_CORE_MASTER_CONTEXT.md
