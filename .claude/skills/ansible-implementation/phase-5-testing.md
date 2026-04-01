# Phase 5: Testing & Rollout Planning

## Your Role

You are the **Lead Orchestrator**. You spawn the Testing & Rollout Specialist and facilitate their collaboration with the Architect and Builder to produce a test strategy, test playbooks, and a rollout plan.

## Team at This Phase

| Role | Name | Status | Purpose |
|------|------|--------|---------|
| Architect | `architect` | Running | Repo-specific context for testing & rollout |
| Devil's Advocate | `devils-advocate` | Idle | Not needed yet |
| Builder | `builder` | Running | Writes test playbooks |
| Best Practices Specialist | `best-practices` | Running (consultant) | Can advise on test playbook patterns |
| Ansible Security Auditor | `ansible-security` | Running (consultant) | Can advise on security validation |
| Linux Security Auditor | `linux-security` | Running (consultant) | Can advise on system validation |
| Testing & Rollout Specialist | `testing-rollout` | **Spawn now** | Test strategy and rollout planning |

## Spawning the Testing & Rollout Specialist

```
You are the Testing & Rollout Specialist for this Ansible implementation. Read your
full agent profile at .claude/agents/ansible-testing-rollout.md and follow its First
Step to discover the repo's deployment patterns and infrastructure layout.

YOUR TASK:
The implementation phase is complete. Read the specification at specs/<SPEC_NAME>.md
and review the code that was implemented (check the task list for what was done and
read the relevant files).

Design:
1. A comprehensive test strategy
2. Test playbook specifications for the Builder to implement
3. A rollout plan appropriate to the risk level

TEAM COMPOSITION (refer to teammates by name):
- architect: Architect — YOUR PRIMARY COLLABORATOR. Ask them about:
  - Which hosts/groups to use as canaries
  - The deployment group structure and how it maps to the fleet
  - Existing test patterns or verification playbooks in the repo
  - How operators typically deploy changes (Make targets, direct playbook runs, etc.)
  - What monitoring is available to validate deployments
- builder: Builder — will write test playbooks based on your specifications.
  Give concrete specs: exact tasks, modules, assertions, file paths.
- best-practices: Best Practices Specialist — ask about idiomatic patterns for
  test/assertion tasks if needed
- ansible-security: Ansible Security Auditor — ask about security-specific validation
  checks if the feature involves security-sensitive components
- linux-security: Linux Security Auditor — ask about system-level validation checks

WORKFLOW:
1. Read the spec and implemented code to understand what was built
2. Message the Architect to discuss repo-specific testing and rollout context
3. Design the test strategy (pre-deployment validation, post-deployment verification,
   regression checks)
4. Design the rollout plan (risk assessment, deployment sequence, gates, rollback)
5. Write test playbook specifications for the Builder
6. Message the Lead with your complete test strategy and rollout plan

IMPORTANT:
- You do NOT write code — give the Builder concrete specs to implement
- Your rollout plan should be actionable: specific hosts, specific commands, specific gates
- Always include a rollback plan
- Consider what could go wrong at each stage of the rollout
```

## Facilitating the Process

### Step 1: Kick off collaboration

Message the Testing & Rollout Specialist:
```
Testing Specialist: Read the spec and implemented code, then collaborate with the
Architect on the test strategy and rollout plan. Message me when you have your
complete strategy ready.
```

Message the Architect:
```
Architect: The Testing & Rollout Specialist will reach out to you for repo-specific
context about testing and deployment patterns. Help them understand the host groups,
canary candidates, deployment workflows, and any existing test patterns.
```

### Step 2: Monitor collaboration

Let the Testing Specialist and Architect work directly. Only intervene if:
- They need user input (relay the question)
- They reach a disagreement about rollout approach (help mediate)

### Step 3: Review the test strategy and rollout plan

When the Testing Specialist reports their strategy:
1. Verify the test strategy covers pre-deployment, post-deployment, and regression
2. Verify the rollout plan has appropriate risk assessment, gates, and rollback
3. Verify test playbook specs are concrete enough for the Builder to implement

### Step 4: Builder writes test playbooks

If the test strategy includes test playbooks to write:
1. Create tasks in the task list for each test playbook
2. Message the Builder with the test playbook specifications from the Testing Specialist
3. The Builder writes the test playbooks, consulting the Testing Specialist and
   Best Practices Specialist as needed
4. Wait for the Builder to complete

### Step 5: Present to user

Present the user with:
1. **Test Strategy Summary**: What will be validated, how, and when
2. **Test Playbooks**: What was written (if any) and what they verify
3. **Rollout Plan**: Risk assessment, deployment sequence, gates, rollback plan
4. **Manual Steps**: Any directives for the user (manual checks, monitoring to watch, etc.)

Inform the user of the test strategy and rollout plan, then immediately proceed to Phase 6 — do not wait for user confirmation.

### Step 6: Devil's Advocate challenge (optional)

If the rollout plan is Medium or High risk, consider reactivating the Devil's Advocate to challenge the Testing Specialist's plan:

```
Devil's Advocate: Review the test strategy and rollout plan produced by the Testing
Specialist. Challenge it: Are there gaps in test coverage? Is the rollout plan
aggressive enough or too conservative? Are there failure modes not covered by the
rollback plan? Message the Testing Specialist directly with your challenges.
```

## Exit Criteria

Phase 5 is complete when:
- [ ] Test strategy is designed and documented
- [ ] Test playbooks are written by the Builder (if applicable)
- [ ] Rollout plan is designed with risk assessment, gates, and rollback
- [ ] User has been informed of the rollout plan
- [ ] All test-related tasks in the task list are complete
