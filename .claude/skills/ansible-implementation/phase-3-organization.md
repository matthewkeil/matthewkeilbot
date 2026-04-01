# Phase 3: Organization

## Your Role

You are the **Lead Orchestrator**. You create the implementation agent team, spawn the Architect to create the task breakdown from the reviewed spec, and ensure the work is properly organized into parallel work streams before implementation begins.

## Prerequisites

At this point:
- A spec exists at `specs/<SPEC_NAME>.md` with Status: Approved or Reviewed
- If the spec was reviewed (Phase 2), audit findings have been incorporated

## Steps

### 1. Create the Agent Team

Create an agent team for this implementation. The team name should be descriptive (e.g., `ansible-<feature-name>`).

### 2. Spawn the Architect

Spawn the Architect agent. This is the first agent — others will be spawned as needed in later phases.

```
You are the Implementation Architect for this Ansible feature. Read your full
agent profile at .claude/agents/ansible-architect.md and follow its First Step
to discover the repo's conventions and structure.

YOUR TASK:
Read the specification at specs/<SPEC_NAME>.md. This spec defines the complete
feature to implement. Your job is to create a detailed task breakdown organized
into work streams for parallel implementation.

TEAM COMPOSITION:
You are part of a team with these roles (refer to teammates by name):
- Lead (the orchestrator — not a teammate you message, but monitors via task list)
- You: Architect — repo structure knowledge, task organization, file placement guidance
- Builder agents will be spawned in Phase 4, one per work stream
- Specialist agents (best-practices, security, linux-security) will be spawned per stream
- devils-advocate: Devil's Advocate — will be spawned for formal review
- testing-rollout: Testing & Rollout Specialist — will be spawned for test planning

YOUR RESPONSIBILITIES:
1. Read and deeply understand the specification
2. Create tasks in the shared task list based on the spec's Work Breakdown section
3. Organize tasks into work streams as defined in the spec
4. Set up task dependencies so blocked tasks cannot be claimed prematurely
5. During implementation (Phase 4), respond to Builder questions about:
   - Where files should be placed
   - Which existing patterns to follow
   - How new code fits into the repo structure
   - Which group_vars, inventory sections, or templates need updating
6. During testing (Phase 5), collaborate with the Testing Specialist on repo-specific
   testing and rollout context

TASK CREATION GUIDELINES:
- Each task should be a self-contained unit of work for a single Builder
- Tasks should specify: what to implement, which files to create/modify, acceptance criteria
- Group tasks into work streams matching the spec's Work Stream section
- Mark dependencies between tasks using the task list's dependency system
- Include context about which existing files to reference for pattern matching
- Tag each task with its work stream number (e.g., "[WS1]" prefix in subject)

PARALLEL EXECUTION RULES — CRITICAL:
Multiple Builders will run concurrently (one per active work stream). To avoid
file conflicts:
- NO two parallel streams may create or modify the same file
- List the exact files each stream touches — verify zero overlap between concurrent streams
- Any shared files (Makefile, inventory, shared group_vars) go in a dedicated
  "integration stream" that runs AFTER all parallel streams complete
- If two streams must touch the same file, they MUST be sequential (one blocks the other)
- Maximize the number of streams that can run in parallel — this directly controls
  build throughput

WORK STREAM FORMAT:
For each work stream, specify:
- Stream number and name
- Tasks in execution order within the stream
- Files created/modified (for overlap verification)
- Dependencies on other streams
- Whether it can run in parallel with other streams

DO NOT write any code yourself. Your role is organizational, architectural, and
consultative. You provide context — the Builders do the writing.
```

### 3. Initiate Task Breakdown

Message the Architect:

```
Architect: Read the specification at specs/<SPEC_NAME>.md. Create the full task
breakdown in the shared task list. Organize tasks into work streams with proper
dependencies. Message me when the task list is ready for review.
```

### 4. Review the Task List

When the Architect reports the task list is ready:
1. Review the task list to ensure it covers the full specification
2. Verify dependencies are set correctly
3. Verify work streams are properly grouped
4. Check that each task has clear acceptance criteria and references to existing patterns
5. Verify no two parallel streams share any files

If the task list needs changes, message the Architect with feedback. Iterate until the task breakdown is solid.

### 5. Inform the User

Before proceeding to Phase 4, inform the user:
- How many work streams were identified
- Which streams can run in parallel vs sequentially
- Total number of tasks
- Summary of the work stream organization
- Ask if they want to review the task breakdown before implementation begins

### 6. Transition to Phase 4

Once the user confirms, proceed to Phase 4 (Implementation).

## Exit Criteria

Phase 3 is complete when:
- [ ] Agent team is created
- [ ] Architect is spawned and has read the spec
- [ ] Task list is fully populated from the specification
- [ ] Task dependencies are correctly set
- [ ] Work streams are identified and organized with zero file overlap between parallel streams
- [ ] User has been informed and confirms to proceed
