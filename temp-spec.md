 VPS Deployment - Implementation Specification

 Context

 The CDK infrastructure will be rewritten later. This Ansible project targets a fresh Ubuntu VPS on a non-AWS cloud provider (DigitalOcean, Hetzner, Linode, etc.)
 and must handle everything from initial OS hardening through application deployment. The ansible/openclaw/ folder is reference material only and will be deleted.

 Overview

 Build a complete Ansible project from scratch to secure a fresh Ubuntu VPS and deploy an OpenClaw bot instance. Uses modular, reusable roles following Ansible
 best practices (FQCN, proper variable precedence, idempotent tasks). Designed for a single host now but structured to scale.

 Target Architecture

 Fresh Ubuntu VPS
 ├── System Layer
 │   ├── devops user (SSH + sudo, key-only auth)
 │   ├── UFW firewall (default-deny, SSH:24324, HTTP:80, HTTPS:443, Tailscale)
 │   ├── SSH hardened (port 24324, key-only, no root)
 │   ├── fail2ban (SSH + nginx jails)
 │   ├── sysctl hardening (network security)
 │   ├── auditd (system event logging)
 │   ├── unattended-upgrades (security patches)
 │   └── /run/shm hardened (noexec)
 │
 ├── Services Layer
 │   ├── Docker CE (installed, ready for future use)
 │   ├── Nginx (multi-vhost skeleton, no sites active yet)
 │   ├── Tailscale (private overlay network + Serve for OpenClaw)
 │   └── Prometheus node_exporter + simple alerting
 │
 ├── Toolchain Layer (system-wide, /opt + /usr/local)
 │   ├── Node.js via n version manager
 │   ├── Python via pyenv
 │   ├── Rust via rustup
 │   └── Zig via checksummed tarball
 │
 └── Application Layer
     └── OpenClaw (single instance)
         ├── Service user: oc-matthewkeilbot
         ├── systemd service with full hardening
         ├── Bound to loopback (127.0.0.1:18789)
         ├── Tailscale Serve for HTTPS access
         └── Secrets from Ansible Vault → .env file

 Access Patterns

 ┌────────────────┬───────────────────────────────────────────┬───────────────────┐
 │    Service     │               Access Method               │        Who        │
 ├────────────────┼───────────────────────────────────────────┼───────────────────┤
 │ SSH            │ Port 24324, key-only, devops user         │ Admin             │
 ├────────────────┼───────────────────────────────────────────┼───────────────────┤
 │ OpenClaw UI    │ Tailscale Serve (<https://hostname.ts.net>) │ Admin via tailnet │
 ├────────────────┼───────────────────────────────────────────┼───────────────────┤
 │ Nginx (future) │ Public HTTP/HTTPS (ports 80/443)          │ Public            │
 ├────────────────┼───────────────────────────────────────────┼───────────────────┤
 │ node_exporter  │ Tailscale only (port 9100)                │ Monitoring        │
 └────────────────┴───────────────────────────────────────────┴───────────────────┘

 Directory Structure

 ansible/
 ├── ansible.cfg
 ├── Makefile
 ├── requirements.yml
 ├── inventory/
 │   └── production/
 │       ├── hosts.yml
 │       ├── group_vars/
 │       │   └── all/
 │       │       ├── vars.yml
 │       │       └── vault.yml
 │       └── host_vars/
 │           └── .gitkeep
 ├── playbooks/
 │   ├── site.yml                    # Full convergence
 │   ├── system.yml                  # Base system setup
 │   ├── deploy.yml                  # OpenClaw deployment
 │   └── toolchain.yml               # Toolchain-only updates
 └── roles/
     ├── common/                     # Base packages, timezone, locale
     ├── users/                      # devops + service users
     ├── security/                   # UFW, SSH, fail2ban, sysctl, auditd, shm, upgrades
     ├── docker/                     # Docker CE installation
     ├── nginx/                      # Nginx + multi-vhost skeleton
     ├── tailscale/                  # Tailscale install + auth + Serve
     ├── node/                       # Node.js via n (system-wide)
     ├── python/                     # Python via pyenv (system-wide)
     ├── rust/                       # Rust via rustup (system-wide)
     ├── zig/                        # Zig (system-wide)
     ├── openclaw/                   # OpenClaw install + systemd + config
     └── monitoring/                 # node_exporter + alerting

 Roles Detail

 common role

- apt update/upgrade
- Install essential packages (curl, wget, git, jq, htop, tree, unzip, software-properties-common)
- Set timezone (configurable, default UTC)
- Configure locale (en_US.UTF-8)
- Set hostname

 users role

- Create devops user with sudo (NOPASSWD), SSH authorized_keys
- Create service users (e.g., oc-matthewkeilbot) with nologin shell, home at /home/oc-matthewkeilbot, mode 0700
- Parameterized: list of service users to create (reusable for future services)

 security role

 Task files for each component (all enabled by default, individually togglable):

- ufw.yml: Default-deny incoming, allow SSH:24324, HTTP:80, HTTPS:443, rate-limit SSH, allow all on tailscale0
- ssh.yml: Port 24324, PermitRootLogin no, PasswordAuthentication no, MaxAuthTries 3, LoginGraceTime 30s, DenyUsers for service accounts. Validate with sshd -t
- fail2ban.yml: SSH jail (port 24324), nginx-http-auth jail. Ban after 5 failures for 10min
- sysctl.yml: Disable IP forwarding (except net.ipv4.ip_forward=1 for Docker), ignore ICMP redirects, SYN cookies, disable source routing, reverse path filtering,
  log martians
- auditd.yml: Install auditd, rules for user/group changes, sudo usage, file permission changes, failed access. Log rotation
- shared_memory.yml: Mount /run/shm with noexec,nosuid,nodev via fstab
- unattended_upgrades.yml: Enable security repo only, no auto-reboot, email notifications (optional)

 docker role

- Add Docker official GPG key + apt repository
- Install docker-ce, docker-ce-cli, containerd.io, docker-compose-plugin
- Enable + start Docker service
- Add devops user to docker group (configurable)
- Do NOT add service users to docker group

 nginx role

- Install nginx from official repo (or Ubuntu default)
- Set up sites-available / sites-enabled pattern
- Deploy a default server block that returns 444 (catch-all, drop unrecognized requests)
- Deploy a readme/example vhost template showing how to add a new site
- Enable + start nginx

 tailscale role

- Install Tailscale via official repo
- Authenticate with auth key from vault
- Enable auto-updates
- Configure UFW for tailscale0 interface
- Tailscale Serve (optional, per-service): Proxy loopback ports over HTTPS on tailnet
- Verify tailscale0 interface exists

 node role

- Install n version manager (checksummed)
- Install Node.js LTS via n (version configurable)
- Symlinks in /usr/local/bin
- Profile script in /etc/profile.d/

 python role

- Install Python build dependencies
- Install pyenv to /opt/pyenv (version pinned)
- Install Python 3 version (configurable)
- Symlinks in /usr/local/bin
- Profile script in /etc/profile.d/

 rust role

- Install rustup to /opt/rust (bootstrap only)
- Install stable toolchain
- Symlinks in /usr/local/bin (rustc, cargo, rustup)
- Profile script in /etc/profile.d/

 zig role

- Download Zig tarball (checksummed)
- Extract to /opt/zig-{version}
- Symlink to /usr/local/bin/zig

 openclaw role

- Install OpenClaw via npm install -g openclaw@{version}
- Create service user's .openclaw/ directory (mode 0700)
- Generate auth token (first deploy only, openssl rand -hex 32)
- Template config file (openclaw-config.json5.j2) — loopback bind, token auth, sandbox mode
- Template env file with secrets from vault (Anthropic API key, Telegram bot token, etc.)
- Template systemd service with full hardening (ProtectSystem, ProtectHome, NoNewPrivileges, syscall filter, etc.)
- Enable + start service
- Configure Tailscale Serve for the bot's port
- Health check

 monitoring role

- Install Prometheus node_exporter (checksummed binary)
- systemd service for node_exporter (bind to Tailscale IP or loopback)
- Simple alerting script (cron-based): check disk usage, memory, service status
- Alert via configurable method (initially: write to log, future: Telegram/email)

 Variables

 group_vars/all/vars.yml

 ┌─────────────────────────┬────────────────────────────────────────────────────────────────┬─────────────────────────────────────┐
 │        Variable         │                            Default                             │             Description             │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ system_timezone         │ UTC                                                            │ Server timezone                     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ system_locale           │ en_US.UTF-8                                                    │ Server locale                       │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ system_hostname         │ matthewkeilbot                                                 │ Server hostname                     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ ssh_port                │ 24324                                                          │ SSH listen port                     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ devops_user             │ devops                                                         │ Admin user name                     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ devops_ssh_public_key   │ (required)                                                     │ SSH public key for devops user      │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ service_users           │ [{name: "oc-matthewkeilbot", home: "/home/oc-matthewkeilbot"}] │ Service accounts                    │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ openclaw_version        │ latest                                                         │ OpenClaw version to install         │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ openclaw_port           │ 18789                                                          │ OpenClaw gateway port               │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ openclaw_bot_name       │ matthewkeilbot                                                 │ Bot instance name                   │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ openclaw_sandbox_mode   │ off                                                            │ Sandbox mode (off/non-main/all)     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ tailscale_serve_enabled │ true                                                           │ Enable Tailscale Serve for OpenClaw │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ node_version            │ 24                                                             │ Node.js major version               │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ python3_version         │ 3.12.8                                                         │ Python 3 version                    │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ zig_version             │ 0.14.1                                                         │ Zig version                         │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ monitoring_alert_method │ log                                                            │ Alert method (log/telegram/email)   │
 └─────────────────────────┴────────────────────────────────────────────────────────────────┴─────────────────────────────────────┘

 group_vars/all/vault.yml (encrypted)

 ┌─────────────────────────────┬────────────────────────────────┐
 │          Variable           │          Description           │
 ├─────────────────────────────┼────────────────────────────────┤
 │ vault_devops_ssh_public_key │ SSH public key for devops      │
 ├─────────────────────────────┼────────────────────────────────┤
 │ vault_tailscale_auth_key    │ Tailscale authentication key   │
 ├─────────────────────────────┼────────────────────────────────┤
 │ vault_anthropic_api_key     │ Anthropic API key for OpenClaw │
 ├─────────────────────────────┼────────────────────────────────┤
 │ vault_telegram_bot_token    │ Telegram bot token             │
 ├─────────────────────────────┼────────────────────────────────┤
 │ vault_openclaw_auth_token   │ (optional) Pre-set auth token  │
 └─────────────────────────────┴────────────────────────────────┘

 Playbook Design

 site.yml — Full convergence

- name: Full system convergence
   hosts: matthewkeilbot
   become: true
   roles:
  - common
  - users
  - security
  - docker
  - nginx
  - tailscale
  - node
  - python
  - rust
  - zig
  - openclaw
  - monitoring

 system.yml — Base system only (no application)

 Roles: common, users, security, docker, nginx, tailscale, node, python, rust, zig, monitoring

 deploy.yml — Application deployment only

 Roles: openclaw (assumes system.yml has been run)

 toolchain.yml — Update toolchains independently

 Roles: node, python, rust, zig

 Makefile Targets

 setup          # First-time full system setup (ansible-playbook playbooks/site.yml)
 deploy         # Deploy/update OpenClaw (ansible-playbook playbooks/deploy.yml)
 system         # System-only convergence (ansible-playbook playbooks/system.yml)
 toolchain      # Update toolchains only
 check          # Dry-run full convergence (--check --diff)
 lint           # Run ansible-lint + yamllint
 vault-edit     # Edit vault file
 vault-encrypt  # Encrypt vault file
 vault-decrypt  # Decrypt vault file (temporary)
 inventory      # Show inventory
 syntax         # Syntax check all playbooks

 Secrets Handling

- All secrets stored in inventory/production/group_vars/all/vault.yml
- Encrypted with ansible-vault
- Vault password managed via --ask-vault-pass or ANSIBLE_VAULT_PASSWORD_FILE
- Secrets referenced as vault_* variables, mapped to runtime variables in vars.yml
- Templates use runtime variable names (not vault_ prefixed) for clarity
- .gitignore excludes *.retry, .ansible_cache/, and any unencrypted vault copies

 Work Breakdown

 Stream 1: Project Scaffolding (no dependencies)

 1. Scaffold project structure — ansible.cfg, Makefile, requirements.yml, inventory structure, .gitignore, playbook stubs
 2. Create vault file — Encrypted vault template with placeholder structure

 Stream 2: Base System (depends on #1)

 1. common role — packages, timezone, locale, hostname
 2. users role — devops user, service users
 3. security role — All sub-components (ufw, ssh, fail2ban, sysctl, auditd, shm, upgrades)

 Stream 3: Services (depends on #4 for user setup)

 1. docker role — Docker CE installation
 2. nginx role — Nginx + multi-vhost skeleton
 3. tailscale role — Tailscale install + auth + Serve support

 Stream 4: Toolchain (depends on #3 common)

 1. node role — n + Node.js
 2. python role — pyenv + Python
 3. rust role — rustup + stable
 4. zig role — checksummed tarball

 Stream 5: Application (depends on #4, #8, #9)

 1. openclaw role — Install, configure, systemd, Tailscale Serve, health check

 Stream 6: Monitoring (depends on #4, #8)

 1. monitoring role — node_exporter + alerting

 Stream 7: Integration (depends on all above)

 1. Playbooks + Makefile — Wire everything together, test full convergence

 Testing Considerations

- Syntax check all playbooks (ansible-playbook --syntax-check)
- Lint with ansible-lint and yamllint
- Dry-run with --check --diff against a test VPS
- Verify each security control individually (UFW rules, SSH config, fail2ban status, sysctl values, auditd rules)
- Verify OpenClaw is running and accessible via Tailscale Serve
- Verify nginx is running with default catch-all
- Verify node_exporter metrics endpoint is accessible

 Rollout Considerations

- Risk level: Medium — fresh host, no existing services to break, but security misconfiguration could lock out SSH access
- Critical safety: SSH config changes must be validated (sshd -t) before restart. UFW rules must allow the new SSH port BEFORE changing sshd port
- Suggested approach: Run against a disposable test VPS first, verify SSH access at each step, then run against production VPS
- Rollback: For a fresh host, re-image and start over. For updates, individual role re-runs

 Open Questions

 None — all requirements gathered through design conversation.

 Key Files to Reference

- ansible/openclaw/ — Reference implementation (read-only, will be deleted)
- CLAUDE.md — Project conventions
- .claude/agents/ansible-architect.md — Architect agent profile
- .claude/agents/ansible-builder.md — Builder agent profile
