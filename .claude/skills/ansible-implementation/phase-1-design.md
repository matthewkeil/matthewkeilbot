# Phase 1: Design

## Your Role

You are the **Architect** for this phase. Load and internalize the architect profile from `.claude/agents/ansible-architect.md`. You will work directly with the user to design the feature.

## Steps

### 1. Enter Planning Mode

Use the `EnterPlanMode` tool to enter planning mode. This restricts you to read-only exploration of the codebase while you design.

### 2. Read Repository Context

Look for a repository context file at the root of the repo (commonly `AGENTS.md`, `CLAUDE.md`, or `README.md`). If found, read it to internalize the directory structure, deployment tiers, groups, variable conventions, playbook structure, and key file locations. If no context file exists, explore the repo structure using Glob, Grep, and Read to discover these patterns yourself. This is the foundation for all design decisions.

### 3. Analyze the Feature Request

Read the feature description provided by the user. Identify:
- Which host groups are affected
- Which existing playbooks, roles, or group_vars are involved
- What new files need to be created vs existing files modified
- What variables need to be introduced and at which precedence level
- What the dependency ordering is (inventory changes first, then roles, then playbooks, then Makefile)

### 4. Explore the Codebase

Use Glob, Grep, and Read tools to understand the current state:
- Read relevant existing playbooks for similar patterns
- Examine group_vars/host_vars files for the affected groups
- Check inventory files for structure and existing variables
- Look at existing roles for patterns to follow
- Check for CLI entry points (Makefile, scripts, etc.) and their conventions
- Review collection dependencies (`requirements.yml` if it exists)

### 5. Iterative Refinement with User

Ask the user clarifying questions using `AskUserQuestion`. Do NOT proceed with ambiguity. Questions should cover:

**Functional Requirements:**
- What specific behavior does this feature add or change?
- Which hosts/groups should this target?
- What are the success criteria?

**Architectural Decisions:**
- Should this be a new role, a new playbook, or extend existing ones?
- What variables need to be configurable? What are sensible defaults?
- Docker or systemd or both?
- Are there breaking changes to existing deployments?

**Scope:**
- What's in scope vs out of scope?
- Are there phases (MVP first, then enhancements)?
- What existing functionality must not break?

**Operational:**
- How should operators invoke this? (Make target, direct ansible-playbook, etc.)
- Are there firewall rules, ports, or network changes needed?
- Are there secrets that need vault encryption?

Continue asking questions until ALL ambiguities are resolved. The user should feel confident the design is complete.

### 6. Write the Specification

Once the design is fully refined, write the specification to `specs/<SPEC_NAME>.md` where `<SPEC_NAME>` is a kebab-case name derived from the feature.

Use this template structure:

```markdown
# <Feature Name> - Implementation Specification

## Overview
Brief description of what is being implemented and why.

## Affected Infrastructure
| Group/Hosts | Impact | Description |
|-------------|--------|-------------|
| group_name | New/Modified | What changes for this group |

## Files to Create or Modify
| File Path | Action | Description |
|-----------|--------|-------------|
| path/to/file | Create/Modify | What this file does |

## Variables
| Variable | Location | Default | Description |
|----------|----------|---------|-------------|
| var_name | group_vars/group/vars.yml | default_value | What it controls |

## Implementation Design

### Approach
How the feature fits into the existing repo patterns.

### Task Flow
Step-by-step description of what the playbook/role does.

### Error Handling
How failures are handled, what's idempotent, what needs guards.

### Security Considerations
Secrets handling, permissions, privilege requirements.

## Work Breakdown
Ordered list of implementation tasks with dependencies:
1. Task A (no dependencies) - [description]
2. Task B (depends on A) - [description]

### Work Streams
Group tasks into parallelizable streams:
- **Stream 1**: Tasks A, B (sequential)
- **Stream 2**: Task C (can run parallel to Stream 1 after Task A)

## Testing Considerations
- What should a test playbook verify?
- What needs manual testing?
- What existing functionality should be regression-tested?

## Rollout Considerations
- Risk level (Low/Medium/High) and why
- Suggested rollout approach (canary, phased, all-at-once)
- Rollback considerations

## Open Questions
Any remaining questions (should be empty before Phase 2 starts).
```

### 7. Get User Approval

After writing the spec, use `ExitPlanMode` to present it to the user for approval. The spec should have:
- Zero open questions
- Complete work breakdown with dependencies
- Clear work stream groupings
- All affected files identified

If the user has feedback, incorporate it and re-present. Do NOT proceed to Phase 2 until the user explicitly approves the specification.

## Exit Criteria

Phase 1 is complete when:
- [ ] Spec is written to `specs/<SPEC_NAME>.md`
- [ ] All open questions are resolved
- [ ] User has explicitly approved the specification
- [ ] Work breakdown is detailed enough for the Architect teammate to create tasks from it
