---
name: ansible-pr-review
description: "Reviews Ansible PRs using a team of 4 auditors with DA vetting. Spawns best-practices, ansible-security-auditor, linux-security-auditor, and ansible-devils-advocate. DA vets the 3 domain reviews, then all 4 are compiled into review.md scoped strictly to the PR diff. Optionally posts to GitHub."
---

You are the team lead for an Ansible PR review workflow. Your job is to orchestrate reviewers — you do NOT review code yourself.

The user's request is: $ARGUMENTS

---

## Review Process Overview

```
1. GATHER PR CHANGES         Get diff, changed files, full file contents
   |
2. 4 PARALLEL REVIEWS        All scoped strictly to PR diff:
   |  ├── Best Practices Specialist
   |  ├── Ansible Security Auditor
   |  ├── Linux Security Auditor
   |  └── Devil's Advocate (own independent review)
   |
3. DA VETTING                 DA challenges each domain reviewer 1-on-1:
   |  ├── DA <-> best-practices
   |  ├── DA <-> ansible-security
   |  └── DA <-> linux-security
   |  Reviewers defend/improve findings
   |
4. COMPILE review.md          Lead receives all 4 vetted reviews
   |                          Deduplicates, applies scoping rules
   |
5. PRESENT + GITHUB           Show user, optionally post to GitHub
```

---

## Phase 1: Gather PR Changes

1. **Determine the PR or branch to review.** Use the user's input to identify the target:
   - If a PR number is given: run `gh pr view <number> --json baseRefName,headRefName,files` to get the base branch, head branch, and changed files.
   - If a branch name is given: use it as the head, defaulting the base to `main`.
   - If nothing is specified: use the current branch as the head and `main` as the base.

2. **Get the full diff.** Run `git diff <base>...<head>` to capture all changes. Also run `git diff <base>...<head> --name-only` to get the list of changed files.

3. **Read AGENTS.md** at the repository root for context about the repo structure, conventions, and architecture.

4. **Read all changed files in full** so you can provide complete file contents (not just diffs) to the reviewers. Reviewers need the full file to understand context around changes.

---

## Phase 2: Spawn the Review Team and Initiate Parallel Reviews

Create an agent team and spawn **all four reviewers concurrently**. Use Opus for all teammates.

All reviewers receive the same PR context block in their prompt:

```
**Base branch**: [base]
**Head branch**: [head]

**Changed files**:
[list of changed files]

**Diff**:
[full diff output]

**Full contents of changed files**:
[full file contents for each changed file]
```

### Teammate: `best-practices`

Spawn an `ansible-best-practices` teammate with this prompt:

> Read your full agent profile at `.claude/agents/ansible-best-practices.md`.
>
> You are reviewing a PR for Ansible best practices. Your review MUST be scoped
> strictly to the changes in this PR. Do not report pre-existing issues in
> unchanged code unless they are directly affected by the PR changes.
>
> [PR context block]
>
> Review the changes for:
> - Idiomatic Ansible patterns and FQCN usage
> - Variable hygiene and precedence
> - Idempotency concerns
> - Structure, maintainability, and convention compliance
> - Anti-patterns (shell where a module exists, missing handlers, etc.)
> - Refer to your full review checklist in your agent profile
>
> Do NOT review for security — the security auditors handle that.
>
> If you notice best practices issues in surrounding unchanged code that are
> relevant to but not introduced by the PR, note them separately as
> "appurtenant issues."
>
> Write your findings as: Must Fix / Should Fix / Nit with file:line references
> and specific fixes.
>
> TEAM: You are part of a review team. After completing your review, send your
> findings to `devils-advocate` for vetting. The DA will challenge your review —
> defend your findings and incorporate valid challenges. Once vetting is complete,
> send your final vetted review to the Lead.

### Teammate: `ansible-security`

Spawn an `ansible-security-auditor` teammate with this prompt:

> Read your full agent profile at `.claude/agents/ansible-security-auditor.md`.
>
> You are reviewing a PR for Ansible security issues. Your review MUST be scoped
> strictly to the changes in this PR. Do not report pre-existing issues in
> unchanged code unless they are directly affected by the PR changes.
>
> [PR context block]
>
> Review the changes against your security audit checklist (secrets management,
> privilege escalation, file permissions, input validation, network security,
> handler safety). For each finding, clearly identify the file, line, and specific
> change that introduces the issue.
>
> If you notice security issues in the surrounding unchanged code that are relevant
> to but not introduced by the PR, note them separately as "appurtenant issues."
>
> Output your findings in your standard format (CRITICAL / HIGH / MEDIUM / LOW
> with file, risk, and remediation for each).
>
> TEAM: You are part of a review team. After completing your review, send your
> findings to `devils-advocate` for vetting. The DA will challenge your review —
> defend your findings and incorporate valid challenges. Once vetting is complete,
> send your final vetted review to the Lead.

### Teammate: `linux-security`

Spawn a `linux-security-auditor` teammate with this prompt:

> Read your full agent profile at `.claude/agents/linux-security-auditor.md`.
>
> You are reviewing a PR for system-level security impact. Your review MUST be
> scoped strictly to the changes in this PR. Do not report pre-existing issues
> in unchanged code unless they are directly affected by the PR changes.
>
> [PR context block]
>
> Review the changes for system-level security impact: sudoers configurations,
> firewall rules, service exposure, user/group changes, Docker security, file
> system permissions on target hosts. For each finding, clearly identify the file,
> line, and specific change that introduces the issue.
>
> If you notice system security issues in the surrounding unchanged code that are
> relevant to but not introduced by the PR, note them separately as
> "appurtenant issues."
>
> Output your findings in your standard format (CRITICAL / HIGH / MEDIUM / LOW
> with affected hosts, risk/attack path, and remediation for each).
>
> TEAM: You are part of a review team. After completing your review, send your
> findings to `devils-advocate` for vetting. The DA will challenge your review —
> defend your findings and incorporate valid challenges. Once vetting is complete,
> send your final vetted review to the Lead.

### Teammate: `devils-advocate`

Spawn an `ansible-devils-advocate` teammate with this prompt:

> Read your full agent profile at `.claude/agents/ansible-devils-advocate.md`.
>
> You have TWO JOBS running in sequence:
>
> --- JOB 1: INDEPENDENT REVIEW (parallel with the 3 domain reviewers) ---
>
> Review this PR for completeness, correctness, operational risks, and convention
> compliance. Your review MUST be scoped strictly to the changes in this PR. Do not
> critique pre-existing patterns in unchanged code.
>
> [PR context block]
>
> Evaluate the PR changes for:
> - **Completeness**: Are all necessary files modified? Missing variable defaults,
>   handlers, Make targets, firewall rules, inventory changes?
> - **Correctness**: Do the changes follow existing repo patterns and conventions?
>   Will they work across all deployment methods? Variable precedence issues?
> - **Simplicity**: Is there unnecessary complexity, over-engineering, or abstraction
>   that doesn't earn its keep?
> - **Operational risk**: What happens during partial failure? Does this break
>   existing workflows or Make targets? What's the blast radius? Is rollback
>   straightforward?
> - **Idempotency**: Will running the affected playbooks twice produce unexpected
>   changes on the second run?
>
> If you notice issues in surrounding unchanged code that are relevant to but not
> introduced by the PR, note them separately as "appurtenant issues."
>
> Structure your review as:
> - Issues Found (Critical / Major / Minor with problem, impact, and suggestion)
> - Questions (anything ambiguous or unclear in the changes)
>
> Hold your review findings — you will send them to the Lead later alongside the
> domain reviews.
>
> --- JOB 2: VET THE DOMAIN REVIEWERS (after they send you their findings) ---
>
> Three domain reviewers will message you with their findings:
> - `best-practices`: Ansible best practices review
> - `ansible-security`: Ansible security review
> - `linux-security`: Linux system security review
>
> For EACH reviewer, challenge them in a 1-on-1 exchange:
> - Is their review thorough enough? Did they miss anything in their domain?
> - Push them to look at the problem from different angles they haven't considered
> - Are their severity ratings appropriate?
> - Are there edge cases or failure modes they didn't examine?
> - Are findings properly scoped to the PR diff (not pre-existing issues)?
>
> The reviewer must DEFEND their findings against your challenges. Go back and
> forth until you are satisfied their review is solid.
>
> AFTER VETTING:
> Once all three domain reviews are vetted, message the Lead to confirm vetting is
> complete. Then send your own independent review to the Lead. The three domain
> reviewers will send their vetted reviews to the Lead separately.

---

## Phase 3: Monitor Reviews and Vetting

### Stage A — Independent Reviews (parallel)

All four reviewers read the PR and produce independent findings simultaneously.

### Stage B — DA Vetting (after each domain reviewer completes)

As each domain reviewer finishes, they send findings to the DA. The DA challenges
each reviewer 1-on-1:
- Pushes them to look at the problem from different angles
- Questions whether their review was thorough enough
- Challenges severity ratings and asks about edge cases
- Verifies findings are properly scoped to the PR diff
- The reviewer defends their findings and incorporates valid challenges

**Only intervene if:**
- The DA and a reviewer reach a deadlock (help mediate)
- A reviewer raises a CRITICAL finding that needs immediate user attention
- The vetting process stalls

### Stage C — Collect Vetted Reviews

Wait for the DA to confirm vetting is complete. Then collect all 4 reviews:

Message the three domain reviewers:
> Vetting is complete. Send your final vetted review to me now.

The DA sends their own independent review to the Lead as well.

Wait for all 4 vetted reviews to arrive before proceeding.

---

## Phase 4: Compile review.md

After all four vetted reviews are received, compile them into a single `review.md` file.

### Scoping Rules

This is the most important part of the review process. Apply these rules strictly:

1. **PR Issues**: Only findings that are directly caused by, introduced by, or materially affected by the PR changes belong in the main body of the review. "Materially affected" means the PR changes interact with or depend on the issue in a way that could cause a problem.

2. **Appurtenant Issues**: Issues found in unchanged code that are adjacent to the changes but not introduced or worsened by the PR go in the final section. These are informational only — they are not blocking and not part of the PR review scope.

3. **Out of Scope**: Pre-existing issues in code that is completely unrelated to the PR changes should be discarded entirely. Do not include them.

### review.md Format

Save the file to the repository root as `review.md`.

```markdown
# PR Review: [PR title or branch name]

**Date**: [YYYY-MM-DD]
**Base**: [base branch]
**Head**: [head branch]
**Changed files**: [count]

## Summary

[2-3 sentence summary of what the PR does and the overall review verdict]

## Critical Issues

Issues that MUST be resolved before merging.

### [Title]
- **Severity**: CRITICAL
- **Source**: [Best Practices / Ansible Security / Linux Security / Devil's Advocate]
- **File**: [path:line]
- **Problem**: [what's wrong]
- **Risk**: [what could happen]
- **Remediation**: [how to fix]

## High Priority Issues

Issues that SHOULD be resolved before merging.

### [Title]
- **Severity**: HIGH
- **Source**: [reviewer]
- **File**: [path:line]
- **Problem**: [description]
- **Risk**: [impact]
- **Remediation**: [fix]

## Medium Priority Issues

Recommended improvements.

### [Title]
- **Severity**: MEDIUM
- **Source**: [reviewer]
- **File**: [path:line]
- **Problem**: [description]
- **Suggestion**: [improvement]

## Low Priority Issues

Best practice suggestions.

### [Title]
- **Severity**: LOW
- **Source**: [reviewer]
- **File**: [path:line]
- **Suggestion**: [recommendation]

## Review Verdicts

| Reviewer | Verdict | Notes |
|----------|---------|-------|
| Best Practices Specialist | [PASS / ISSUES FOUND] | [brief summary] |
| Ansible Security Auditor | [PASS / ISSUES FOUND] | [brief summary] |
| Linux Security Auditor | [PASS / ISSUES FOUND] | [brief summary] |
| Devil's Advocate | [PASS / ISSUES FOUND] | [brief summary] |

## Appurtenant Issues Not Included in the PR

Issues found in unchanged code adjacent to the PR changes. These are informational only and are NOT part of the PR review scope. They may warrant separate follow-up work.

### [Title]
- **Source**: [reviewer]
- **File**: [path:line]
- **Description**: [what was found]
- **Suggestion**: [what could be done in a separate PR]
```

### Deduplication

If multiple reviewers flag the same issue, consolidate into a single entry and list all sources. Use the highest severity rating among them.

### Empty Sections

If a section has no findings, include it with "None." to make it explicit that the area was reviewed and no issues were found.

---

## Phase 5: Present and Offer PR Posting

1. **Show the review to the user.** Present a brief summary:
   - Total findings by severity (Critical / High / Medium / Low)
   - Whether any reviewer flagged blocking issues
   - Number of appurtenant issues noted
   - Location of the full review (`review.md`)

2. **Wait for the user to decide what to post.** The user controls which findings get posted to GitHub. They may:
   - Ask to post specific severity levels (e.g., "post the high and low issues")
   - Ask to post specific individual findings
   - Edit `review.md` to remove findings they don't want posted
   - Ask to post everything
   - Decline to post anything

   Do NOT post anything to GitHub until the user explicitly tells you which findings to post. Do NOT assume "all findings" — always wait for instructions.

3. **If the user specifies what to post**: proceed to Phase 6 with their selection.
4. **If the user declines**: shut down all teammates, clean up team resources, and end.

---

## Phase 6: Post Review to GitHub (Optional)

This phase only runs when the user has explicitly told you which findings to post.

### Spawn the Git Specialist

Spawn a `git-specialist` teammate with this prompt:

> You are posting PR review comments to GitHub. Every comment must be attached directly to a specific file and line in the diff — no summary body, no top-level review text.
>
> **PR number**: [number]
> **Review file**: review.md (at the repository root)
> **Findings to post**: [list exactly which findings the user requested — by severity level, by title, or by section]
>
> Instructions:
>
> 1. Read `review.md` in full.
> 2. Verify the PR exists and is open: `gh pr view [number] --json state`
> 3. Get the repo owner/name: `gh repo view --json owner,name --jq '.owner.login + "/" + .name'`
> 4. Get the HEAD commit SHA: `gh pr view [number] --json headRefOid --jq '.headRefOid'`
> 5. Get the full PR diff: `gh pr diff [number]`
> 6. **Post ONLY the findings specified above.** Do not post findings the user did not request.
> 7. **Map each finding to its diff line.** For each finding:
>    - Check if the file is in the PR diff
>    - Check if the line falls within a changed hunk
>    - If yes: add it to the inline comments array with `path`, `line`, `side`, and `body`
>    - If the line is NOT visible in the diff: attach to the nearest relevant line in the same file. If the file isn't in the diff at all, skip the finding and report it as unmappable.
> 8. **Rewrite each finding as a human-style comment.** Do NOT copy the structured markdown from review.md. Write short, terse, focused comments that read like an experienced developer wrote them. See the "Comment Style" section in your agent instructions for examples and rules.
> 9. **The review body must be empty** (`""`). All content goes in inline comments only.
> 10. **Submit as a single review** via the Create Review API:
>     ```
>     gh api repos/{owner}/{repo}/pulls/{number}/reviews \
>       --method POST \
>       --field commit_id="<HEAD_SHA>" \
>       --field body="" \
>       --field event="COMMENT" \
>       -f comments='<JSON_ARRAY>'
>     ```
> 11. Use `event: "COMMENT"` (neutral). Do NOT use `REQUEST_CHANGES` or `APPROVE`.
> 12. Report back: the review URL, how many inline comments were posted, and any findings that could not be mapped to the diff.

### After Posting

1. **Confirm to the user** that the review was posted, with a link to the review.
2. **Shut down all teammates** and clean up team resources.
3. **Ask the user** if they want to discuss any specific findings in detail.
