# Building a New Skill

## Original Prompt

i want you to look at the structure of the libp2p-implementation skill for reference.  i want to make a new version of the ansible-implementation skill,
  named ansible-implementation-2.md that uses the structure and layout of the libp2p one but is tailored for ansible.  ideally we will use the existing agents  
  but before we start the skill lets talk about the correct mix of agents and roles that they should take to ensure we have the right personas for the job.
  the goal is to split up tasks such that it preserves context and give a higher quality output.

- i think there should still be an architect with general overarching infrastruture knowledge and understanding of how the repo is structured
- i think there should be ansible security auditor
- i think there should be linux security auditor
- i think there should be an ansible builder
- i question the "reveiwer" and wonder if that should be updated so that it has ansible best practices ingrained. and references to several best practice
  documents that it can rely on
- like the idea of the devils advocate

  the goal is such that the builder should not need to know everything, it can ask the security auditor questions, the asible-best-practices (old reveiwer)
  questions about that so it wont need to have those docs in contextm.  it can ask the architect where to place files and which sections of the codebase to
  update so that it does not need to know the context of the codebase. and so on, such that the individuals act only on their respective expertise and only the
   builder has to actually "do" anything.  only maybe perhaps the architect will "do" things insomuch that it will create the tasks and organize the workflows.
   but the other teammates will strictly be a source of reference and code reveiw (done in isoplation with respect to their specialty).

## Claude Thinking

  each of the teammates should know the composition of the team and how to get information that they need
  ⎿  ⧉ Selected 1 lines from .claude/agents/ansible-architect.md in Visual Studio Code

⏺ Let me read the libp2p skill and the existing ansible agents to understand what we're working with.

⏺ Searched for 1 pattern, read 5 files (ctrl+o to expand)

⏺ Now let me also read the existing ansible agents to understand their current personas.

⏺ Read 6 files (ctrl+o to expand)

⏺ Now I have a full picture. Let me lay out my thinking on the team composition.

  Proposed Team Composition

  The libp2p skill has 5 roles: Architect, Spec Specialist, TS Engineer, Testing Engineer, Code Reviewer. The key insight from that design is the Spec Specialist
  pattern — a dedicated knowledge source that other agents query instead of loading specs themselves. Your vision extends this further: instead of one knowledge
  source, you want multiple domain-specific consultants that the builder can query.

  Here's how I'd map it:

  1. Architect (organizer, not builder)

- Reads AGENTS.md, understands repo structure
- Creates task breakdown, organizes work streams
- The builder asks it: "where should this file go?", "which group_vars need updating?", "what existing patterns should I follow?"
- May also do Phase 1 design work (like the libp2p architect)

  1. Builder (sole implementer)

- Writes all code. Knows Ansible syntax but doesn't need to know this specific repo's layout or security rules
- Asks the Architect for file placement and repo context
- Asks the Best Practices Specialist for idiomatic Ansible patterns
- Asks the Security Auditors for security guidance when writing sensitive tasks
- This keeps its context focused purely on writing code

  1. Ansible Best Practices Specialist (replaces Reviewer)

- This is where I think the biggest upgrade is. Instead of just "check conventions after the fact," this agent would:
  - Have references to Ansible best practice docs (e.g., Ansible docs on playbook best practices, Red Hat's hardening guides, common anti-patterns)
  - Be consulted during implementation ("is this the right way to handle this docker restart?") not just after
  - Also do post-implementation review focused on idiomatic Ansible, idempotency, variable precedence
  - Does not review for security (that's the auditors' job)

  1. Ansible Security Auditor (consultant + reviewer)

- Same persona as today but also available for proactive questions from the builder
- "I need to handle a vault password in this template — what's the right pattern?"
- Then does a full audit pass after implementation

  1. Linux Security Auditor (consultant + reviewer)

- Same dual role: available for questions during build, full audit after
- "I'm writing a sudoers template — any GTFOBins concerns with this command list?"

  1. Devil's Advocate (plan challenger + audit triage)

- Challenges the Architect's plan in Phase 1
- Triages audit findings in Phase 4 (separating real issues from noise)

## First Round of Questions

  Open questions for you:

  1. The "Reviewer" rename — I'm thinking ansible-best-practices as the new agent name. It would reference external docs like the official Ansible best practices
  guide, common Galaxy lint rules, and known anti-patterns. Does that feel right, or do you want it to remain more of a "code reviewer" that happens to know best
  practices deeply?
  2. Testing — the libp2p skill has a dedicated Testing Engineer. For Ansible, testing is different (molecule, ansible-lint, --check mode). Should the Best
  Practices Specialist cover linting/testing guidance, or do you want a separate agent for that?
  3. Review phase structure — In libp2p, the formal review is a separate Phase 4 with multiple independent reviewers. For your flow, it sounds like you want the
  auditors and best practices specialist to each review independently in isolation (so they don't contaminate each other's context), then the Devil's Advocate
  triages the combined findings. Is that right?
  4. Builder asking questions — Should the builder proactively ask for guidance before writing each task, or should it implement first and then the specialists
  review? (The former preserves more context but is slower; the latter is faster but may require more fix cycles.)

✻ Cogitated for 55s

### My responses to the questions Claude had

❯ 1) i like the rename! good work!
  2) yes, create a separate agent for that. it should cover how to "test a feature" either through directives to the user or by writing a "test playbook".  it  
  should also cover ideas of how to roll out a feature such that there is surety across the fleet (canary roll-out, or a/b testing type of stuff) and can work
  with the architect that has repo specific knowledge on how the testing and rolloout planning should work so that its thorough. this should be an explicit
  step in the skill i think but i leave that up to you on how you think it best fits into the workflow. use your "devils' advocate" hat on that so that we get
  the right solution.
  3) that seems like the right approach.  the devils advocate can can work with each of the reviewers to challenge their reports and get them to think deeply
  about the comments and review process so its viewed from many angles by each of the reviewers/auditors
  4) im fine with a slower but more thorough approach, i think it should ask questions along the way during the build process
