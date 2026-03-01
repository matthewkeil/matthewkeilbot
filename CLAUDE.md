# matthewkeilbot

OpenClaw deployment configuration for AWS using CDK and Ansible.

## Project Structure

```
infra/                  # AWS CDK infrastructure (TypeScript)
ansible/                # Ansible playbooks for deployment
config/                 # Configuration templates
.claude/
  settings.json         # Permission rules (allow/deny for tools and commands)
  agents/
    aws-infrastructure-auditor.md   # CDK/CloudFormation/Terraform security & cost audit
    ansible-architect.md            # Ansible infrastructure design and planning
    ansible-best-practices.md       # Idiomatic Ansible patterns and code quality
    ansible-builder.md              # Ansible code implementation
    ansible-devils-advocate.md      # Critical review of Ansible plans and audit triage
    ansible-security-auditor.md     # Ansible security vulnerability audit
    ansible-testing-rollout.md      # Test strategies and rollout plans
    git-specialist.md               # Git/GitHub workflows, PR management
    linux-security-auditor.md       # Linux system security audit
  skills/
    ansible-implementation/         # Multi-phase Ansible implementation workflow (/ansible-implementation)
```

## Commands

```bash
# CDK
cd infra && npm install           # Install dependencies
npx cdk synth                     # Synthesize CloudFormation
npx cdk deploy MatthewkeilbotStack -c computeAccountId=XXX -c domainName=bot.matthewkeil.com

# Ansible
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbooks/setup.yml
ansible-playbook playbooks/deploy.yml
```

## Architecture

- **Two AWS accounts**: DNS account (Route53) and Compute account (EC2)
- **Direct EC2**: No ALB, uses Elastic IP + Caddy for TLS
- **Caddy**: Auto TLS via Let's Encrypt, reverse proxy to OpenClaw on :18789

## Code Style

- TypeScript for CDK (strict mode)
- YAML for Ansible (use FQCN for modules)
- Use `ansible.builtin.*` not short names

## Important

- SSM parameters use `/matthewkeilbot/` prefix
- Domain: `bot.matthewkeil.com`
- Always audit CDK changes with the `aws-infrastructure-auditor` agent
- Always audit Ansible changes with the `ansible-security-auditor` and `ansible-best-practices` agents
- Use the `ansible-implementation` skill (`/ansible-implementation`) for full multi-phase Ansible workflows
- Use the `git-specialist` agent for complex git/GitHub operations
- Use the `linux-security-auditor` agent when changes affect host-level security
