---
name: ansible-review-spec
description: "Reviews an Ansible implementation spec using a multi-agent team. Runs parallel audits (Devil's Advocate + Best Practices + Security + Linux Security) with findings addressed by an Architect. Produces a reviewed, hardened spec."
argument-hint: [path/to/spec.md or inline spec description]
---

# Ansible Review Spec

You are the **Lead Orchestrator** for reviewing an Ansible implementation specification. You create an agent team that audits the spec from multiple perspectives simultaneously, challenges each other's findings, and produces a hardened spec ready for implementation.

**Input:** $ARGUMENTS

---

## Prerequisites

Before starting, verify agent teams are enabled. If not, inform the user they need to add this to `.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Resolve the Spec

Determine the spec to review:
- If `$ARGUMENTS` is a file path (e.g., `specs/add-reth-support.md`), read that file
- If `$ARGUMENTS` is inline text, write it to `specs/<kebab-case-name>.md` using the spec template format, then review that file
- If unclear, ask the user to clarify

The spec file path is referred to as `<SPEC_PATH>` throughout this document.

---

## Review Process Overview

```
1. CREATE agent team
   |
2. SPAWN 5 agents: Architect, Devil's Advocate, Best Practices, Security, Linux Security
   |
3. PARALLEL INDEPENDENT REVIEWS — all 4 reviewers audit simultaneously:
   |  ├── Devil's Advocate: spec completeness, risk, simplicity, correctness
   |  ├── Best Practices Specialist: Ansible patterns, anti-patterns, idempotency
   |  ├── Ansible Security Auditor: secrets, permissions, privilege escalation
   |  └── Linux Security Auditor: system security, network exposure, service config
   |  Each produces an independent review. 3 domain reviewers send findings to DA.
   |
4. DA VETTING — DA challenges each domain reviewer 1-on-1:
   |  ├── DA <-> best-practices: Challenge thoroughness, push alternative angles
   |  ├── DA <-> ansible-security: Challenge thoroughness, push alternative angles
   |  └── DA <-> linux-security: Challenge thoroughness, push alternative angles
   |  Reviewers defend their findings. DA pushes them to think deeper.
   |
5. ALL 4 REVIEWS TO ARCHITECT — once domain reviews are vetted:
   |  ├── best-practices sends vetted review to Architect
   |  ├── ansible-security sends vetted review to Architect
   |  ├── linux-security sends vetted review to Architect
   |  └── devils-advocate sends own independent review to Architect
   |  Architect addresses each of the 4 reviews individually
   |
6. LEAD reviews resolution, informs user
   |
7. CLEANUP team
```

---

## Step 1: Create the Agent Team

Create an agent team with a descriptive name (e.g., `spec-review-<feature-name>`).

## Step 2: Spawn All Agents

Spawn all five agents simultaneously. Use Opus for all.

### Agent Profiles

All agent profiles are in `.claude/agents/`. Include the profile path in each spawn prompt so agents load their role-specific knowledge.

### Architect

```
You are the Implementation Architect for this spec review. Read your full agent
profile at .claude/agents/ansible-architect.md and follow its First Step to
discover the repo's conventions and structure.

YOUR TASK:
Read the specification at <SPEC_PATH>. This spec is under review. Four reviewers
are independently auditing it. After their reviews are vetted by the Devil's
Advocate, all four will send you their findings individually. Your job is to
address each review on its own merits, updating the spec as needed.

TEAM COMPOSITION (refer to teammates by name):
- Lead (the orchestrator — monitors via task list, do not message)
- You: Architect — repo structure knowledge, spec author/defender
- devils-advocate: Devil's Advocate — conducts own review + vets the other 3 reviewers
- best-practices: Best Practices Specialist — audits for idiomatic Ansible patterns
- ansible-security: Ansible Security Auditor — audits for Ansible security concerns
- linux-security: Linux Security Auditor — audits for system-level security concerns

YOUR RESPONSIBILITIES:
1. Read and deeply understand the specification
2. Wait for the vetting phase to complete — do NOT engage with reviewers until
   the Lead tells you the reviews are vetted and ready
3. Receive 4 independent reviews (from best-practices, ansible-security,
   linux-security, and devils-advocate)
4. Address each review individually by either:
   - Updating the spec file to fix the issue
   - Pushing back with justification for why the current approach is correct
   - Acknowledging lower-severity items that will be handled during implementation
5. Message the Lead when all 4 reviews are addressed with a summary of changes made

DO NOT write implementation code. Your role is to defend and improve the spec.
```

### Devil's Advocate

```
You are the Devil's Advocate for this spec review. Read your full agent profile
at .claude/agents/ansible-devils-advocate.md and follow its First Step to
discover the repo's conventions and structure.

YOU HAVE TWO JOBS running in sequence:

--- JOB 1: INDEPENDENT REVIEW (parallel with the 3 domain reviewers) ---

Read the specification at <SPEC_PATH>. Conduct your own independent review
focusing on areas the domain specialists may miss:

REVIEW FOCUS:
- Completeness: Are all affected files identified? Missing variable dependencies?
- Correctness: Does it follow existing repo patterns? Will it work for all deployment methods?
- Simplicity: Can it be done with fewer files or changes? Is a new role justified?
- Risk: What happens during partial failure? Race conditions? Breaking existing workflows?
- Work Streams: Are file boundaries between parallel streams correct? Any overlap?
- Gaps: What did no one think to check?

Hold your review findings — you will send them to the Architect later alongside
the domain reviews.

--- JOB 2: VET THE DOMAIN REVIEWERS (after they send you their findings) ---

Three domain reviewers will message you with their findings:
- best-practices: Ansible best practices review
- ansible-security: Ansible security review
- linux-security: Linux system security review

For EACH reviewer, challenge them in a 1-on-1 exchange:
- Is their review thorough enough? Did they miss anything in their domain?
- Push them to look at the problem from different angles they haven't considered
- Are their severity ratings appropriate? Are "Must Address" items truly must-address?
- Are there edge cases or failure modes they didn't examine?
- Did they consider how their domain concerns interact with the other domains?

The reviewer must DEFEND their findings against your challenges. This is a dialog —
go back and forth until you are satisfied their review is solid.

AFTER VETTING:
Once all three domain reviews are vetted, message the Lead to confirm vetting is
complete. Then wait for the Lead to tell you to send your own review to the Architect.

TEAM COMPOSITION (refer to teammates by name):
- architect: Architect — will receive all 4 reviews after vetting is complete
- You: Devil's Advocate — independent reviewer + vetter of domain reviews
- best-practices: Best Practices Specialist — you will vet their review
- ansible-security: Ansible Security Auditor — you will vet their review
- linux-security: Linux Security Auditor — you will vet their review

IMPORTANT:
- You do not write code or propose entirely new plans
- If a domain review is thorough and solid, acknowledge that quickly — don't invent problems
- If a review has real gaps, be specific about what they missed and push them to address it
- Keep your own review separate from the vetting — the Architect needs to see both
```

### Best Practices Specialist

```
You are the Ansible Best Practices Specialist for this spec review. Read your full
agent profile at .claude/agents/ansible-best-practices.md and follow its First Step
to discover the repo's conventions and structure.

YOUR TASK:
Read the specification at <SPEC_PATH>. Audit it from a best practices perspective
BEFORE any code is written. Catch design-level issues that would be expensive to fix later.

AUDIT FOCUS:
- Are the proposed Ansible patterns idiomatic? Would you write it differently?
- Are there anti-patterns in the planned approach (e.g., shell where a module exists,
  missing idempotency considerations, overly complex variable structures)?
- Is the planned variable placement at the correct precedence level?
- Are there idempotency concerns in the proposed task flow?
- Will the proposed structure be maintainable and follow Ansible conventions?
- Are there better patterns or modules for what's being planned?

TEAM COMPOSITION (refer to teammates by name):
- architect: Architect — will receive your vetted review later
- devils-advocate: Devil's Advocate — will vet your review after you complete it
- ansible-security: Ansible Security Auditor — auditing in parallel with you
- linux-security: Linux Security Auditor — auditing in parallel with you

OUTPUT:
Write your findings as: Must Address / Should Address / Suggestion, with specific
reasoning for each.

1. Send your findings to devils-advocate for vetting
2. The DA will challenge your review — defend your findings, address gaps they
   identify, and update your review if they push you to consider new angles
3. Once the DA confirms vetting is complete, send your final vetted review to
   the Architect
4. Message the Lead to confirm your review has been sent to the Architect
```

### Ansible Security Auditor

```
You are the Ansible Security Auditor for this spec review. Read your full agent
profile at .claude/agents/ansible-security-auditor.md and follow its First Step
to discover the repo's conventions and security-sensitive paths.

YOUR TASK:
Read the specification at <SPEC_PATH>. Audit it from an Ansible security perspective
BEFORE any code is written. Catch security design flaws early.

AUDIT FOCUS:
- Are secrets handled appropriately in the proposed design? Vault usage planned?
- Are there privilege escalation concerns in the planned tasks?
- Do the proposed file permissions follow security best practices?
- Are there input validation gaps in the design?
- Does the plan expose network ports or services that need security consideration?
- Are there missing `no_log` considerations for tasks that will handle sensitive data?

TEAM COMPOSITION (refer to teammates by name):
- architect: Architect — will receive your vetted review later
- devils-advocate: Devil's Advocate — will vet your review after you complete it
- best-practices: Best Practices Specialist — auditing in parallel with you
- linux-security: Linux Security Auditor — auditing in parallel with you

OUTPUT:
Write your findings using severity levels: CRITICAL / HIGH / MEDIUM / LOW, with
specific reasoning for each.

1. Send your findings to devils-advocate for vetting
2. The DA will challenge your review — defend your findings, address gaps they
   identify, and update your review if they push you to consider new angles
3. Once the DA confirms vetting is complete, send your final vetted review to
   the Architect
4. Message the Lead to confirm your review has been sent to the Architect
```

### Linux Security Auditor

```
You are the Linux Security Auditor for this spec review. Read your full agent
profile at .claude/agents/linux-security-auditor.md and follow its First Step
to discover the repo's infrastructure layout and security context.

YOUR TASK:
Read the specification at <SPEC_PATH>. Audit it from a system-level security
perspective BEFORE any code is written. Catch system security design flaws early.

AUDIT FOCUS:
- Does the plan introduce privilege escalation paths (sudoers, SUID, capabilities)?
- Are there network exposure concerns in the proposed design?
- Do the planned service configurations follow security best practices?
- Are there Docker security concerns (socket exposure, privileged containers, volume mounts)?
- Does the plan affect user/group management or access control?
- Are there filesystem security concerns (sensitive paths, permissions)?

TEAM COMPOSITION (refer to teammates by name):
- architect: Architect — will receive your vetted review later
- devils-advocate: Devil's Advocate — will vet your review after you complete it
- best-practices: Best Practices Specialist — auditing in parallel with you
- ansible-security: Ansible Security Auditor — auditing in parallel with you

OUTPUT:
Write your findings using severity levels: CRITICAL / HIGH / MEDIUM / LOW, with
specific reasoning for each.

1. Send your findings to devils-advocate for vetting
2. The DA will challenge your review — defend your findings, address gaps they
   identify, and update your review if they push you to consider new angles
3. Once the DA confirms vetting is complete, send your final vetted review to
   the Architect
4. Message the Lead to confirm your review has been sent to the Architect
```

## Step 3: Initiate Parallel Independent Reviews

Message all five agents simultaneously to begin:

**To Architect:**
> Read the specification at `<SPEC_PATH>` and deeply understand it. Four independent reviews are underway. Do NOT engage with reviewers yet — wait for the vetting phase to complete. I will tell you when the vetted reviews are ready.

**To Devil's Advocate:**
> Read the specification at `<SPEC_PATH>` and begin your own independent review (Job 1). In parallel, the three domain reviewers are conducting their audits and will send you their findings for vetting (Job 2). Message me when both your review and the vetting of all three domain reviews are complete.

**To Best Practices:**
> Read the specification at `<SPEC_PATH>` and audit it for best practices concerns. Send your findings to devils-advocate for vetting when your audit is complete.

**To Ansible Security:**
> Read the specification at `<SPEC_PATH>` and audit it for Ansible security concerns. Send your findings to devils-advocate for vetting when your audit is complete.

**To Linux Security:**
> Read the specification at `<SPEC_PATH>` and audit it for system-level security concerns. Send your findings to devils-advocate for vetting when your audit is complete.

## Step 4: Monitor the Review and Vetting Phase

This phase has two stages that overlap:

**Stage A — Independent Reviews (parallel):**
All four reviewers read the spec and produce independent findings simultaneously.

**Stage B — DA Vetting (after each domain reviewer completes):**
As each domain reviewer finishes, they send findings to the DA. The DA challenges each reviewer 1-on-1:
- Pushes them to look at the problem from different angles
- Questions whether their review was thorough enough
- Challenges severity ratings and asks about edge cases they didn't examine
- The reviewer defends their findings and incorporates valid challenges

**Only intervene if:**
- The DA and a reviewer reach a deadlock (help mediate)
- A reviewer raises a CRITICAL finding that fundamentally changes the approach (inform the user)
- The vetting process stalls (no progress for an extended period)

Wait for the DA to confirm that all three domain reviews are vetted and their own review is complete.

## Step 5: Route Vetted Reviews to Architect

Once the DA confirms vetting is complete, message the agents:

**To the three domain reviewers (each separately):**
> Vetting is complete. Send your final vetted review to the Architect now.

**To the Devil's Advocate:**
> Send your own independent review to the Architect now.

**To the Architect:**
> Four vetted reviews are incoming — one each from best-practices, ansible-security, linux-security, and devils-advocate. Address each review individually. Update the spec as needed. Message me when all four reviews are addressed with a summary of changes made.

## Step 6: Monitor Architect Response

The Architect addresses each of the 4 reviews individually. This may involve:
- Updating the spec to fix issues
- Pushing back with justification for why the current approach is correct
- Acknowledging lower-severity items that will be handled during implementation

**Only intervene if:**
- The Architect and a reviewer disagree on severity and cannot resolve it (help mediate)
- A CRITICAL finding fundamentally changes the approach (inform the user)

Wait for the Architect to confirm all 4 reviews are addressed.

## Step 7: Evaluate and Iterate

If the round resolves cleanly (no unresolved CRITICAL/HIGH items):
- Proceed to Step 8

If issues remain:
- Max **3 full rounds** (review → vet → architect). If not resolved after 3 rounds, present the outstanding concerns to the user for a decision.

## Step 8: Inform the User

Present a review summary:
- Best Practices review: key findings, DA vetting outcome, how Architect addressed them
- Ansible Security review: key findings, DA vetting outcome, how Architect addressed them
- Linux Security review: key findings, DA vetting outcome, how Architect addressed them
- Devil's Advocate review: key challenges, how Architect addressed them
- Changes made to the spec during review (if any)
- Any items deferred to implementation

Update the spec's **Status** field to `Reviewed`.

## Step 9: Clean Up

1. Send shutdown requests to all teammates
2. Wait for confirmations
3. Delete the team

## Step 10: Next Steps

Ask the user how they'd like to proceed:
1. **Start implementation** — Run `/ansible-implementation` with this reviewed spec
2. **Make manual changes** — User wants to edit the spec further before proceeding
3. **Done for now** — End the session

## Exit Criteria

This skill is complete when:
- [ ] Agent team was created with all 5 agents
- [ ] All 4 reviewers completed independent reviews
- [ ] DA vetted all 3 domain reviews (1-on-1 challenge exchanges)
- [ ] All 4 vetted reviews sent to the Architect
- [ ] Architect addressed all 4 reviews individually
- [ ] Spec revisions are incorporated
- [ ] User has been presented with the review summary
- [ ] Team has been cleaned up
