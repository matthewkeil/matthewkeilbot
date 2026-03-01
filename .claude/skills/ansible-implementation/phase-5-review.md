# Phase 5: Formal Review

## Your Role

You are the **Lead Orchestrator**. You manage the formal review process: coordinating independent reviews, facilitating the Devil's Advocate challenge rounds, and tracking review-fix cycles.

## Team at This Phase

| Role | Name | Status | Purpose |
|------|------|--------|---------|
| Architect | `architect` | Running | Available for context questions |
| Devil's Advocate | `devils-advocate` | **Reactivate** | Challenges each reviewer |
| Builder | `builder` | Running | Fixes findings |
| Best Practices Specialist | `best-practices` | Running | **Reviews code** |
| Ansible Security Auditor | `ansible-security` | Running | **Reviews code** |
| Linux Security Auditor | `linux-security` | Running | **Reviews code** |
| Testing & Rollout Specialist | `testing-rollout` | Running (optional) | Available if test artifacts need review |

## Review Process Overview

```
1. Three independent reviews (parallel, isolated)
   ├── best-practices: Reviews for idiomatic Ansible, conventions, idempotency
   ├── ansible-security: Reviews for Ansible-level security
   └── linux-security: Reviews for system-level security

2. Devil's Advocate challenges each reviewer (sequential)
   ├── DA <-> best-practices: Challenge best practices findings
   ├── DA <-> ansible-security: Challenge security findings
   └── DA <-> linux-security: Challenge system security findings

3. Devil's Advocate triages combined findings
   └── Produces: Must Fix / Should Fix / Out of Scope

4. Builder fixes Must Fix items

5. Repeat from step 1 if Must Fix items remain (up to 6 cycles)
```

## Step 1: Initiate Independent Reviews

Message all three reviewers simultaneously. Each reviews the FULL implementation (including test playbooks from Phase 4) but ONLY within their domain:

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
file:line references and specific fixes). Message me when your review is complete.
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
file:line references and specific remediations). Message me when your audit is complete.
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
affected hosts, attack paths, and specific remediations). Message me when your audit
is complete.
```

## Step 2: Devil's Advocate Challenge Rounds

After all three reviewers report their findings, reactivate the Devil's Advocate to challenge each reviewer individually. This ensures findings are thorough and well-reasoned.

### Sequence

The Devil's Advocate works with one reviewer at a time to avoid cross-contamination:

```
Devil's Advocate: The formal reviews are complete. Your job is to challenge each
reviewer individually to deepen their analysis. Work with them one at a time:

1. First, message best-practices. Review their findings. Challenge them:
   - Did they miss any anti-patterns? Push them to look harder at edge cases.
   - Are their "Must Fix" items truly must-fix, or are some just preferences?
   - Are there idempotency issues they didn't catch?
   - After your challenge round, message me that you're done with best-practices.

2. Next, message ansible-security. Review their findings. Challenge them:
   - Did they check all secrets paths? Are there vault references they missed?
   - Are there privilege escalation patterns they didn't flag?
   - Is their severity rating appropriate?
   - After your challenge round, message me that you're done with ansible-security.

3. Finally, message linux-security. Review their findings. Challenge them:
   - Did they analyze all sudoers configurations for GTFOBins?
   - Are there Docker security concerns they missed?
   - Is the network exposure assessment complete?
   - After your challenge round, message me that you're done with linux-security.

After challenging all three reviewers, compile a TRIAGED findings report:
- Must Fix: [findings that are real, impactful, and must be fixed before deployment]
- Should Fix: [findings that are real but non-blocking]
- Out of Scope: [findings that are pre-existing or unrelated to this implementation]

Message me with the triaged report.
```

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
   - Message reviewers: "Review Round <N>: Focus on the areas that were fixed. Also check for regressions. Message me with any new findings."
   - Repeat Steps 1-4

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
