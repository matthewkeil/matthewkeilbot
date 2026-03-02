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
│   ├── UFW firewall (default-deny in, allow SSH:vault_port/HTTP:80/HTTPS:443)
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
│   ├── Tailscale (private overlay network, base firewall rules on tailscale0)
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
        ├── Own UFW rule + Tailscale Serve config (service-owns-config)
        ├── Accessed via Tailscale Serve (https://hostname.ts.net)
        ├── Auth token generated on first deploy
        └── Secrets: Ansible Vault → templated .env
```

## Design Principles

### Service-Owns-Config

Each service/application role owns its own network configuration:
- **UFW rules**: Infrastructure roles (security, tailscale) provide only base rules. Each service role adds its own UFW rules for the `tailscale0` interface (conditional on interface existence).
- **Tailscale Serve**: Configured by the consuming role (e.g., openclaw), not the tailscale role.
- **Audit rules**: Base system audit rules live in the security role's `hardening.rules`. Each service role deploys its own audit rules file to `/etc/audit/rules.d/` (e.g., `docker.rules`, `tailscale.rules`, `monitoring.rules`, `openclaw.rules`).

This ensures infrastructure roles have zero knowledge of application-specific ports, services, or configuration, and services can be added or removed without modifying infrastructure roles.

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
│   ├── hosts.ini                       # Host inventory (no secrets — IP via vault)
│   ├── group_vars/
│   │   └── all/
│   │       ├── vars.yml                # Common variables (references vault_ vars)
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
│   ├── update_nginx.yml                # Update nginx sites (stub — future use)
│   ├── validate_vars.yml              # Validate prerequisite variables
│   ├── test_bootstrap.yml             # Verify post-bootstrap state (pre-hardening)
│   ├── test_system.yml                # Verify post-system state
│   ├── test_services_and_app.yml      # Verify services and application state
│   └── rollback_system.yml            # Clean up stale system artifacts
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
- Vault password via `.vault_pass` file (configured in `ansible.cfg` as `vault_password_file`)
- Tailscale auth key is NOT stored in vault. It is passed via CLI (`-e tailscale_auth_key=...`) during first-time Tailscale setup only.
- The `.vault_pass` file is in `.gitignore` and `.claudeignore` — it must never be committed.

## Architecture

- **Target architecture:** x86_64 (amd64)
- All binary checksums in `group_vars/all/vars.yml` are for x86_64 artifacts
- `setup_toolchain.yml` and `setup_services.yml` include a pre_tasks assertion that fails if `ansible_architecture != 'x86_64'`
- To deploy on a different architecture: update all checksums in `vars.yml` and update the assertion

### Vault Contents

| Vault Variable | Description |
|----------------|-------------|
| `vault_ansible_host` | VPS IP address (used by `ansible_host` in group_vars) |
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

| Target | Description |
|--------|-------------|
| `make bootstrap` | First-time VPS bootstrap — creates devops user + SSH port (as root, port 22). Run `make system` next! |
| `make system` | System layer (common + users + security) — run promptly after bootstrap to harden |
| `make services` | Services layer (docker + nginx + tailscale + monitoring). Asserts x86_64 architecture. |
| `make toolchain` | Toolchain layer (node + python + rust + zig). Asserts x86_64 architecture. |
| `make deploy-openclaw` | Deploy/update OpenClaw |
| `make update-nginx` | Nginx site updates (stub) |
| `make check` | Syntax check all playbooks + dry-run `all.yml --check --diff` |
| `make lint` | Run ansible-lint and yamllint |
| `make validate` | Validate all prerequisite variables (no server needed) |
| `make test-bootstrap` | Verify post-bootstrap state (before `make system`) |
| `make test-system` | Run system layer verification tests |
| `make test-app` | Run services/toolchain/application verification tests |
| `make test` | Run all verification tests (test-system + test-app) |
| `make rollback-system` | Clean up stale system artifacts (locale, auditd, audit rules) |
| `make vault-edit` | Edit the encrypted vault file |
| `make vault-view` | View vault contents without decrypting on disk |
| `make vault-encrypt` | Encrypt the vault file |
| `make vault-decrypt` | Decrypt the vault file (re-encrypt when done!) |
| `make ping` | Test connectivity to hosts |
| `make facts` | Gather and display host facts |
| `make deps` | Install Ansible Galaxy dependencies |

> **Note:** Vault password is provided automatically via `.vault_pass` file (configured in `ansible.cfg`). No `--ask-vault-pass` needed.

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
