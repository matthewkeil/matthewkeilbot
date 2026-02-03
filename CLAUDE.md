# matthewkeilbot

OpenClaw deployment configuration for AWS using CDK and Ansible.

## Project Structure

```
infra/           # AWS CDK infrastructure (TypeScript)
ansible/         # Ansible playbooks for deployment
config/          # Configuration templates
.claude/agents/  # Audit agents (AWS, Ansible)
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
- Always audit CDK changes with `.claude/agents/aws-infrastructure-auditor.md`
- Always audit Ansible changes with `.claude/agents/ansible-auditor.md`
