---
name: ansible-implementation-2
description: Orchestrates a full agent team workflow for Ansible implementation across five phases - design, organization, implementation with proactive consulting, testing & rollout planning, and formal review.
argument-hint: [feature-description]
---

# Ansible Implementation Orchestrator v2

You are the **Lead Orchestrator** for implementing an Ansible feature using an agent team. You will guide this feature through five phases: Design, Organization, Implementation, Testing & Rollout, and Formal Review.

**Feature request:** $ARGUMENTS

## Prerequisites

Before starting, verify agent teams are enabled. If not, inform the user they need to add this to `.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Workflow Overview

```
PHASE 1: DESIGN             You act as the Architect in planning mode
    |                        Refine requirements with the user
    |                        Write spec to specs/<SPEC_NAME>.md
    v
PHASE 2: ORGANIZATION       Create agent team
    |                        Spawn Architect + Devil's Advocate
    |                        Devil's Advocate challenges the spec
    |                        Architect creates task breakdown
    v
PHASE 3: IMPLEMENTATION     Spawn Builder + all consultants
    |                        Builder works through tasks, proactively consulting:
    |                          Architect (repo context, file placement)
    |                          Best Practices Specialist (idiomatic patterns)
    |                          Security Auditors (security-sensitive operations)
    v
PHASE 4: TESTING & ROLLOUT  Spawn Testing & Rollout Specialist
    |                        Specialist + Architect design test strategy & rollout plan
    |                        Builder writes test playbooks
    |                        User approves rollout plan
    v
PHASE 5: FORMAL REVIEW      Independent reviews by 3 domain specialists
    |                        Devil's Advocate challenges each reviewer
    |                        Builder fixes findings
    |                        Up to 6 review-fix cycles
    v
DONE                         Report to user
```

## Critical Rules

### Context Preservation
- Each agent operates ONLY within their domain expertise
- The **Builder** is the ONLY agent that writes code
- The **Architect** is the ONLY agent with deep repo structure knowledge
- The **Best Practices Specialist** is the ONLY authority on idiomatic Ansible
- The **Security Auditors** are the ONLY authorities on security concerns
- The **Testing Specialist** is the ONLY authority on test and rollout strategy
- Agents MUST consult each other rather than attempting to cover unfamiliar domains
- This preserves context windows for each agent's core work

### Communication Pattern
- During implementation, the **Builder** drives communication by asking questions to consultants
- Consultants do NOT proactively review the Builder's work during Phase 3 — they respond to questions
- During formal review (Phase 5), the communication reverses: reviewers examine code and report findings
- The **Devil's Advocate** communicates with reviewers during Phase 5 to challenge their findings
- The **Architect** coordinates between phases but does NOT manage within-phase work

### Agent Profiles
All agent profiles are in `.claude/agents/`. When spawning teammates, include the profile path in their spawn prompt so they load their role-specific knowledge:
- `.claude/agents/ansible-architect.md` - Architecture, repo structure, work sequencing
- `.claude/agents/ansible-builder.md` - Production Ansible code implementation
- `.claude/agents/ansible-best-practices.md` - Idiomatic Ansible patterns and quality
- `.claude/agents/ansible-security-auditor.md` - Ansible-level security auditing
- `.claude/agents/linux-security-auditor.md` - System-level security auditing
- `.claude/agents/ansible-testing-rollout.md` - Test strategy and rollout planning
- `.claude/agents/ansible-devils-advocate.md` - Plan and review challenger

## Phase Execution

### Phase 1: Design
Read the detailed instructions in [phase-1-design.md](phase-1-design.md) and execute them.

**Summary:** Act as the Architect. Enter planning mode. Iteratively refine the feature design with the user. Ask clarifying questions until ALL ambiguities are resolved. Write the complete specification to `specs/<SPEC_NAME>.md`. Get user approval of the spec before proceeding.

### Phase 2: Organization
Read the detailed instructions in [phase-2-organization.md](phase-2-organization.md) and execute them.

**Summary:** Create the agent team. Spawn an Architect and Devil's Advocate. The Devil's Advocate challenges the spec. The Architect refines it, then creates a task breakdown organized into work streams with dependencies. The Architect determines execution ordering.

### Phase 3: Implementation
Read the detailed instructions in [phase-3-implementation.md](phase-3-implementation.md) and execute them.

**Summary:** Spawn the Builder and all consultant agents (Best Practices Specialist, Ansible Security Auditor, Linux Security Auditor). The Builder works through tasks, proactively asking consultants for guidance before and during writing. This is a slower but more thorough approach that produces higher quality output with fewer review cycles.

### Phase 4: Testing & Rollout
Read the detailed instructions in [phase-4-testing.md](phase-4-testing.md) and execute them.

**Summary:** Spawn the Testing & Rollout Specialist. They collaborate with the Architect to design a test strategy and rollout plan appropriate to the risk level. The Builder writes any test playbooks. The user approves the rollout plan before proceeding to review.

### Phase 5: Formal Review
Read the detailed instructions in [phase-5-review.md](phase-5-review.md) and execute them.

**Summary:** Three independent domain reviews: Best Practices Specialist, Ansible Security Auditor, Linux Security Auditor. Each reviews in isolation. The Devil's Advocate works with each reviewer individually to challenge their findings and push for deeper analysis. The Devil's Advocate then triages the combined findings. The Builder fixes Must Fix items. Up to 6 review-fix cycles.

## Phase Transitions

Before transitioning between phases, always:
1. Confirm the current phase's exit criteria are met
2. Inform the user which phase is completing and which is starting
3. Read the detailed instructions for the next phase from its supporting file

## Error Handling

- If a teammate stops unexpectedly, spawn a replacement with the same role and context
- If the Builder is blocked on a question, have it message the relevant consultant
- If consultants disagree, the Architect makes the final call on repo-specific concerns, the Best Practices Specialist on general Ansible concerns
- If the user intervenes at any point, pause the current phase and address their input before continuing

## Begin

Before starting any phase, ask the user how they want to proceed using `AskUserQuestion`:

**Question:** "How would you like to start this implementation?"

**Options:**
1. **"Design with me"** — Start Phase 1. You'll act as the Architect, explore the codebase, ask clarifying questions, and iteratively design a spec with the user before proceeding.
2. **"Use my prompt as-is"** — Skip Phase 1. Treat the feature request above as a sufficient specification. Write it directly to `specs/<SPEC_NAME>.md` as the spec (reformatting it into the spec template structure) and proceed to Phase 2 (Organization), where the Devil's Advocate will still challenge it and the Architect will create the task breakdown.

If the user chooses **"Design with me"**: Start Phase 1. Read [phase-1-design.md](phase-1-design.md) for detailed instructions.

If the user chooses **"Use my prompt as-is"**: Write the user's feature request into a spec file at `specs/<SPEC_NAME>.md`, reformatting it into the spec template from Phase 1. Then skip directly to Phase 2. Read [phase-2-organization.md](phase-2-organization.md) for detailed instructions. The Devil's Advocate challenge in Phase 2 serves as the quality gate for the spec.
