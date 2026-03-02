# VPS Deployment — Architecture Overview

## Context

This project builds a complete Ansible deployment from scratch targeting a fresh Ubuntu VPS (on DigitalOcean, Hetzner, Linode, etc)

## Target Architecture

```
Fresh Ubuntu VPS (Ubuntu 24.04 LTS)
│
├── System Layer
│   ├── devops user (SSH + sudo, key-only auth on custom port)
│   ├── Service users (nologin shell, isolated home dirs)
│   ├── UFW firewall (default-deny in, allow SSH:vault_port/HTTP:80/HTTPS:443/Tailscale)
│   ├── SSH hardened (custom port, key-only, no root, MaxAuthTries=3)
│   ├── fail2ban (SSH + nginx jails)
│   ├── sysctl hardening (network security kernel params)
│   ├── auditd (system event audit logging)
│   ├── unattended-upgrades (security patches only, no auto-reboot)
│   └── /dev/shm hardened (noexec,nosuid,nodev)
│
├── Services Layer
│   ├── Docker CE (installed, devops user in docker group, ready for future use)
│   ├── Nginx (multi-vhost skeleton, default catch-all, no sites active)
│   ├── Tailscale (private overlay network, Serve for OpenClaw UI)
│   └── Prometheus node_exporter + cron-based alerting
│
├── Toolchain Layer (system-wide installs under /opt and /usr/local)
│   ├── Node.js via n version manager
│   ├── Python via pyenv
│   ├── Rust via rustup
│   └── Zig via checksummed tarball
│
└── Application Layer
    └── OpenClaw (single instance)
        ├── Service user: matthewkeilbot (nologin, home /home/matthewkeilbot)
        ├── systemd service: openclaw@matthewkeilbot.service
        ├── Bound to loopback only (127.0.0.1:vault_openclaw_port)
        ├── Accessed via Tailscale Serve (https://hostname.ts.net)
        ├── Auth token generated on first deploy
        └── Secrets: Ansible Vault → templated .env
```

## Access Patterns

| Service | Port/Interface | Access Method | Who |
|---------|---------------|---------------|-----|
| SSH | vault_ssh_port / public IP | Direct SSH, key-only auth | Admin (devops user) |
| OpenClaw UI | vault_openclaw_port / loopback | Tailscale Serve (HTTPS) | Admin via tailnet |
| Nginx (future sites) | 80, 443 / public IP | Public HTTP/HTTPS | Public |
| node_exporter | 9100 / tailscale0 or loopback | Tailscale network | Monitoring |

## Ansible Project Structure

```
ansible/
├── ansible.cfg                         # Ansible configuration
├── Makefile                            # Operator-facing commands
├── requirements.yml                    # Galaxy collection dependencies
├── .gitignore                          # Exclude caches, retries, unencrypted vaults
│
├── inventory/
│   ├── hosts.ini                       # Host inventory
│   ├── group_vars/    
│   │   └── all/    
│   │       ├── vars.yml                # Common variables
│   │       └── vault.yml               # Encrypted secrets (ansible-vault)
│   └── host_vars/    
│       └── .gitkeep                    # Ready for per-host overrides
│
├── playbooks/
│   ├── all.yml                         # Full convergence (all layers)
│   ├── bootstrap_ssh.yml               # First-time VPS bootstrap (bootstrap role)
│   ├── setup_system.yml                # System layer (common + users + security)
│   ├── setup_services.yml              # Services layer (docker + nginx + tailscale + monitoring)
│   ├── setup_toolchain.yml             # Toolchain layer (node + python + rust + zig)
│   ├── deploy_openclaw.yml             # Deploy OpenClaw application
│   └── update_nginx.yml                # Update nginx sites (stub — future use)
│
└── roles/
    ├── bootstrap/                      # → see specs/02-system/00-bootstrap.md
    ├── common/                         # → see specs/02-system/01-common.md
    ├── users/                          # → see specs/02-system/02-users.md
    ├── security/                       # → see specs/02-system/03-security.md
    ├── docker/                         # → see specs/03-services/01-docker.md
    ├── nginx/                          # → see specs/03-services/02-nginx.md
    ├── tailscale/                      # → see specs/03-services/03-tailscale.md
    ├── monitoring/                     # → see specs/03-services/04-monitoring.md
    ├── node/                           # → see specs/04-toolchain/01-node.md
    ├── python/                         # → see specs/04-toolchain/02-python.md
    ├── rust/                           # → see specs/04-toolchain/03-rust.md
    ├── zig/                            # → see specs/04-toolchain/04-zig.md
    └── openclaw/                       # → see specs/05-application/01-openclaw.md
```

## Secrets Management

- All secrets in `inventory/group_vars/all/vault.yml`, encrypted with `ansible-vault`
- Vault variables use `vault_` prefix (e.g., `vault_ssh_port`)
- Runtime variables in `vars.yml` reference vault vars (e.g., `ssh_port: "{{ vault_ssh_port }}"`)
- Templates use runtime variable names (never `vault_*` directly)
- Vault password via `--ask-vault-pass` or `ANSIBLE_VAULT_PASSWORD_FILE` environment variable
- Tailscale auth key is NOT stored in vault. It is passed via CLI (`-e tailscale_auth_key=...`) during first-time Tailscale setup only.

### Vault Contents

| Vault Variable | Description |
|----------------|-------------|
| `vault_ssh_port` | SSH listen port for sshd configuration |
| `vault_devops_ssh_public_key` | SSH public key for devops user |
| `vault_openclaw_port` | OpenClaw gateway listen port |

## Playbook Execution Order

### `bootstrap_ssh.yml` (first-time VPS bootstrap)

```
bootstrap
```

> Run once on a bare VPS as root on port 22. Creates the devops user and changes the SSH port. Follow with `make system` for full hardening.

### `all.yml` (full convergence)

```
common → users → security → docker → nginx → tailscale → monitoring
  → node → python → rust → zig → openclaw
```

### `setup_system.yml` (system layer only)

```
common → users → security
```

### `setup_services.yml` (services layer only)

```
docker → nginx → tailscale → monitoring
```

### `setup_toolchain.yml` (toolchain layer only)

```
node → python → rust → zig
```

### `deploy_openclaw.yml` (application deploy, assumes system/services/toolchain done)

```
openclaw
```

### `update_nginx.yml` (stub — no-op for now)

Future per-site nginx vhost deployments. Each application that needs a public nginx vhost will get its own deploy playbook.

## Invocation (Makefile)

| Target | Command | Description |
|--------|---------|-------------|
| `make bootstrap` | `ansible-playbook playbooks/bootstrap_ssh.yml -e ansible_user=root -e ansible_port=22` | First-time VPS bootstrap -- creates devops user + SSH port. Run `make system` next! |
| `make system` | `ansible-playbook playbooks/setup_system.yml` | System layer (common + users + security) -- run promptly after bootstrap to harden |
| `make services` | `ansible-playbook playbooks/setup_services.yml` | Services layer only |
| `make toolchain` | `ansible-playbook playbooks/setup_toolchain.yml` | Toolchain layer only |
| `make deploy-openclaw` | `ansible-playbook playbooks/deploy_openclaw.yml` | Deploy/update OpenClaw |
| `make upgrade-openclaw` | `ansible-playbook playbooks/deploy_openclaw.yml -e openclaw_version=latest` | Upgrade OpenClaw to latest version |
| `make update-nginx` | `ansible-playbook playbooks/update_nginx.yml` | Nginx site updates (stub) |
| `make check` | Syntax check all playbooks + dry-run `all.yml --check --diff` | Validate everything |
| `make lint` | `ansible-lint && yamllint .` | Lint all files |
| `make vault-edit` | `ansible-vault edit ...vault.yml` | Edit vault |

## Implementation Order

| Phase | Stream | Spec | Dependencies |
|-------|--------|------|-------------|
| 1 | Scaffolding | [01-project-scaffolding.md](01-project-scaffolding.md) | None |
| 2 | System | [02-system/00-bootstrap.md](02-system/00-bootstrap.md) | Phase 1 |
| 2 | System | [02-system/01-common.md](02-system/01-common.md) | Phase 1 |
| 2 | System | [02-system/02-users.md](02-system/02-users.md) | Phase 1 |
| 2 | System | [02-system/03-security.md](02-system/03-security.md) | Phase 1 |
| 3 | Services | [03-services/01-docker.md](03-services/01-docker.md) | users role |
| 3 | Services | [03-services/02-nginx.md](03-services/02-nginx.md) | common role |
| 3 | Services | [03-services/03-tailscale.md](03-services/03-tailscale.md) | security role (UFW) |
| 3 | Services | [03-services/04-monitoring.md](03-services/04-monitoring.md) | tailscale role |
| 4 | Toolchain | [04-toolchain/01-node.md](04-toolchain/01-node.md) | common role |
| 4 | Toolchain | [04-toolchain/02-python.md](04-toolchain/02-python.md) | common role |
| 4 | Toolchain | [04-toolchain/03-rust.md](04-toolchain/03-rust.md) | common role |
| 4 | Toolchain | [04-toolchain/04-zig.md](04-toolchain/04-zig.md) | common role |
| 5 | Application | [05-application/01-openclaw.md](05-application/01-openclaw.md) | users, tailscale, node |
| 6 | Integration | [06-integration/01-playbooks-and-makefile.md](06-integration/01-playbooks-and-makefile.md) | All roles |
