# Phase 5: Formal Review

## Your Role

You are the **Lead Orchestrator**. You kick off the review process and track review-fix cycles. The Devil's Advocate acts as the review hub — reviewers send findings to the DA, the DA challenges them and triages, then reports to you. This keeps detailed review discussion out of your context.

## Team at This Phase

| Role | Name | Status | Purpose |
|------|------|--------|---------|
| Architect | `architect` | Running | Available for context questions |
| Devil's Advocate | `devils-advocate` | **Reactivate** | Review hub: receives findings, challenges reviewers, triages, reports to Lead |
| Builder | `builder` | Running | Fixes findings |
| Best Practices Specialist | `best-practices` | Running | **Reviews code** |
| Ansible Security Auditor | `ansible-security` | Running | **Reviews code** |
| Linux Security Auditor | `linux-security` | Running | **Reviews code** |
| Testing & Rollout Specialist | `testing-rollout` | Running (optional) | Available if test artifacts need review |

## Review Process Overview

```
1. Lead kicks off reviews and activates Devil's Advocate
   ├── Three reviewers begin independent reviews (parallel)
   └── Devil's Advocate waits to receive findings

2. Reviewers send findings directly to Devil's Advocate (NOT the Lead)
   ├── best-practices → devils-advocate: Best practices findings
   ├── ansible-security → devils-advocate: Security audit findings
   └── linux-security → devils-advocate: System security findings

3. Devil's Advocate challenges each reviewer (1-on-1 exchanges)
   ├── DA <-> best-practices: Challenge best practices findings
   ├── DA <-> ansible-security: Challenge security findings
   └── DA <-> linux-security: Challenge system security findings

4. Devil's Advocate triages combined findings
   └── Sends triaged report to Lead: Must Fix / Should Fix / Out of Scope

5. Lead has Builder fix Must Fix items

6. Repeat from step 1 if Must Fix items remain (up to 6 cycles)
```

**Key design choice:** Reviewers communicate directly with the Devil's Advocate, not the Lead. This keeps the detailed review findings and challenge discussions out of the Lead's context window. The Lead only receives the final triaged report.

## Step 1: Initiate Reviews and Activate Devil's Advocate

First, reactivate the Devil's Advocate so it's ready to receive findings. Then message all three reviewers simultaneously.

### Activate Devil's Advocate

```
Devil's Advocate: The formal review phase is starting. Three reviewers will each send
you their findings directly. Your job:

1. RECEIVE findings from each reviewer as they complete their review
2. CHALLENGE each reviewer in 1-on-1 exchanges (message them back directly):
   - best-practices: Did they miss anti-patterns? Are "Must Fix" items truly must-fix?
     Are there idempotency issues they didn't catch?
   - ansible-security: Did they check all secrets paths? Are there privilege escalation
     patterns they missed? Is severity rating appropriate?
   - linux-security: Did they analyze all sudoers configurations for GTFOBins? Are there
     Docker security concerns they missed? Is network exposure assessment complete?
3. After challenging all three, TRIAGE the combined findings:
   - Must Fix: [findings that are real, impactful, and must be fixed before deployment]
   - Should Fix: [findings that are real but non-blocking]
   - Out of Scope: [findings that are pre-existing or unrelated to this implementation]
4. Message the Lead with the triaged report

IMPORTANT: You communicate directly with the reviewers. The Lead does NOT need to see
the individual findings or challenge discussions — only your final triaged report.
```

### Best Practices Specialist Review

```
Best Practices Specialist: Time for formal review. Switch to your Mode 2 (Post-Implementation
Reviewer) from your agent profile.

Review ALL files created or modified during this implementation. Check the task list
for what was implemented and read every affected file.

Review ONLY for best practices concerns:
- Idiomatic Ansible patterns and FQCN usage
- Variable hygiene and precedence
- Idempotency
- Structure, maintainability, and convention compliance
- Refer to your full review checklist in your agent profile

Do NOT review for security — the security auditors handle that.

Write your findings using your output format (Must Fix / Should Fix / Nit with
file:line references and specific fixes).

IMPORTANT: Send your findings directly to devils-advocate (NOT the Lead). The Devil's
Advocate will challenge your findings and compile the final report.
```

### Ansible Security Auditor Review

```
Ansible Security Auditor: Time for formal security audit. Review ALL files created
or modified during this implementation.

Audit ONLY for Ansible-level security:
- Secrets management (vault usage, no_log, credential exposure)
- Privilege escalation patterns
- File and permission security
- Input validation
- Network security
- Handler safety
- Refer to your full audit checklist in your agent profile

Do NOT review for code quality or Linux system security — other specialists handle that.

Write your findings using your output format (CRITICAL / HIGH / MEDIUM / LOW with
file:line references and specific remediations).

IMPORTANT: Send your findings directly to devils-advocate (NOT the Lead). The Devil's
Advocate will challenge your findings and compile the final report.
```

### Linux Security Auditor Review

```
Linux Security Auditor: Time for formal system security audit. Review ALL files created
or modified during this implementation.

Audit ONLY for system-level security impact:
- Privilege escalation paths (sudoers, SUID, capabilities)
- Network exposure (firewall rules, service binding, port exposure)
- Service security (systemd units, Docker configuration)
- User and access control
- File system security
- Refer to your full audit checklist in your agent profile

Do NOT review for Ansible code quality or Ansible-level secrets handling — other
specialists handle that.

Write your findings using your output format (CRITICAL / HIGH / MEDIUM / LOW with
affected hosts, attack paths, and specific remediations).

IMPORTANT: Send your findings directly to devils-advocate (NOT the Lead). The Devil's
Advocate will challenge your findings and compile the final report.
```

## Step 2: Wait for Devil's Advocate Triaged Report

The Devil's Advocate handles the entire review-challenge process autonomously:
1. Receives findings from each reviewer as they complete
2. Challenges each reviewer in 1-on-1 exchanges
3. Compiles and triages the combined findings
4. Sends the triaged report to the Lead

**You do NOT need to intervene** during this process. The reviewers and DA communicate directly. Only intervene if:
- A reviewer or the DA asks you a question
- The DA reports a disagreement it cannot resolve
- The process stalls (no progress for an extended period)

## Step 3: Builder Fixes

When the Devil's Advocate reports the triaged findings:

1. Review the triage — ensure Must Fix items are genuinely critical
2. Create tasks for the Builder for each Must Fix item
3. Message the Builder:

```
Builder: The formal review is complete. The following Must Fix items need to be addressed:

<list the Must Fix items with file:line references and specific fixes>

Fix each item. For any fix you're unsure about, consult the relevant specialist
(best-practices, ansible-security, or linux-security) before making the change.
Mark each task complete when done. Message me when all fixes are complete.
```

4. Wait for the Builder to complete all fixes

## Step 4: Evaluate

After the Builder reports fixes are complete:

1. Check: Are there remaining Must Fix items?
   - If the triaged report only had Must Fix items that are now fixed: **review is complete**
   - If reviewers raised new concerns during the challenge round: **start next cycle**

2. If another cycle is needed:
   - Increment the round counter
   - Repeat Steps 1-2: kick off reviewers and DA again. Reviewers focus on fixed areas
     and check for regressions, sending findings to the DA as before.
   - Continue through Steps 3-4

## Round Limit

**Maximum 6 rounds.** If after 6 rounds there are still unresolved Must Fix items:

1. Compile a summary of all remaining issues
2. Message the user:
   ```
   Formal review has completed 6 rounds but the following issues remain unresolved:

   Must Fix items:
   <list with descriptions>

   Should Fix items still open:
   <list>

   How would you like to proceed?
   Options:
   1. Continue with additional review rounds
   2. Accept the current state and address remaining items manually
   3. Provide guidance on specific items
   ```
3. Wait for the user's response before taking any further action

## Completion

When the formal review is complete (all Must Fix items resolved):

1. Message the user with a completion summary:
   - Total review rounds completed
   - Findings by category across all reviewers
   - Number of findings resolved
   - Summary of what was implemented (reference the spec)
   - Should Fix or Nit items that were intentionally deferred
   - Test strategy and rollout plan (from Phase 4)

2. Ask the user if they want to:
   - Commit the changes
   - Run any validation (syntax check, dry run)
   - Make additional changes
   - Proceed with the rollout plan from Phase 4

3. Clean up the agent team:
   - Send shutdown requests to all teammates
   - Wait for confirmations
   - Delete the team

## Exit Criteria

Phase 5 is complete when:
- [ ] All three domain reviews are complete
- [ ] Devil's Advocate has challenged each reviewer
- [ ] All Must Fix items are resolved
- [ ] User has been presented with the completion summary
- [ ] User has confirmed they are satisfied
- [ ] All teammates have been shut down
- [ ] Team has been cleaned up
