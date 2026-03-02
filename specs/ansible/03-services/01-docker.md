# Role Spec: `docker`

## Purpose

Install Docker CE from the official Docker repository with UFW isolation and security hardening. Add the `devops` user to the docker group. Application roles that need Docker access (e.g., openclaw) add their own users to the docker group — the docker role does not manage application-specific users.

## Role Structure

```
roles/docker/
├── tasks/
│   └── main.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
├── templates/
│   └── daemon.json.j2
└── meta/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `docker_edition` | `ce` | Community Edition |
| `docker_packages` | docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin | Full plugin stack |
| `docker_users` | `[devops_user \| default('devops')]` | Users granted docker group membership |
| `docker_denied_users` | derived from `service_users` | Users that must never be in docker group |
| `docker_daemon_config` | see below | Docker daemon configuration (always applied) |

### `docker_daemon_config` defaults

| Setting | Value | Purpose |
|---|---|---|
| `iptables` | `true` | Docker manages its own iptables chains (required for container networking) |
| `ip-forward` | `true` | Enable IP forwarding (required for container internet access) |
| `userland-proxy` | `false` | Use kernel hairpin NAT instead of docker-proxy processes (CIS benchmark) |
| `live-restore` | `true` | Containers survive daemon restarts (important during upgrades) |
| `ip6tables` | `false` | Disable Docker IPv6 management (IPv4-only container addressing) |
| `no-new-privileges` | `true` | Default `--security-opt=no-new-privileges` for all containers (CIS benchmark) |
| `log-driver` | `json-file` | JSON file logging with rotation |
| `log-opts` | `max-size: 10m, max-file: 3` | 30MB max per container log |
| `default-address-pools` | `172.17.0.0/12, size 24` | Standard private range for Docker networks |

## Tasks

### 1. Install prerequisites
- Install: ca-certificates, curl, gnupg
- Note: These packages are also installed by the common role; this task is a no-op safety net.

### 2. Add Docker GPG key
- Create `/etc/apt/keyrings` directory (mode 0755)
- Download and install Docker GPG key to `/etc/apt/keyrings/docker.gpg`
- Source URL: `https://download.docker.com/linux/{{ ansible_distribution | lower }}/gpg`
- Note: Do NOT use the deprecated `ansible.builtin.apt_key` module. Use direct GPG key download to `/etc/apt/keyrings/` as specified.

### 3. Add Docker repository
- Detect system architecture via `dpkg --print-architecture`
- Add signed apt repository for the detected arch and distribution release (stable channel), using `ansible_distribution | lower` for portability
- Filename: `docker`

### 4. Install Docker packages
- Install all packages from `docker_packages`
- Run with `update_cache: true`
- Notify handler to restart Docker on change

### 5. Manage Docker group membership
- Add each user in `docker_users` to the `docker` group (append, do not replace)
- For each user in `docker_denied_users`, remove them from the docker group using `gpasswd -d`
- For `gpasswd -d`: use specific `failed_when` condition that only suppresses the 'is not a member of' error message, not all errors. Use `changed_when` that checks for 'removed' in the output.

### 6. Configure Docker daemon
- Ensure `/etc/docker` directory exists
- Deploy `docker_daemon_config` as JSON via `daemon.json.j2` template to `/etc/docker/daemon.json` (owner root, group docker, mode 0640)
- Notifies handler to restart Docker

### 7. Docker UFW isolation (DOCKER-USER chain)
- Deploy iptables rules to `/etc/ufw/after.rules` using `blockinfile` (marker: `ANSIBLE MANAGED BLOCK - Docker isolation`)
- Rules in the DOCKER-USER chain:
  - Allow established/related connections (container-initiated outbound traffic)
  - Allow localhost (`lo`) — host-to-container communication
  - Allow `tailscale0` — Tailscale Serve to containers
  - Default DROP all other forwarded traffic — blocks external access to published container ports
- This addresses the well-known Docker/UFW bypass where Docker manipulates iptables directly, bypassing UFW rules
- Notifies `Reload UFW` then `Restart docker` to ensure correct rule ordering

### 8. Deploy Docker audit rules
- Deploy Docker audit rules to `/etc/audit/rules.d/docker.rules` (watches `/var/run/docker.sock` tagged `docker_access`, watches `/usr/bin/docker` execution tagged `docker_command`). Notify `Reload audit rules` handler.

### 9. Enable services
- Enable and start `docker` via systemd
- Enable and start `containerd` via systemd

## Handlers

- **Reload UFW**: reloads UFW to apply after.rules changes
- **Restart docker**: restarts the `docker` systemd service and ensures it remains enabled (must run after UFW reload to re-insert Docker's iptables rules)
- **Reload audit rules**: restarts auditd using `service auditd restart` (auditd has `RefuseManualStop=yes` on Ubuntu 24.04)

## Security Notes

- **Docker/UFW bypass**: Docker by default manipulates iptables directly, bypassing UFW entirely. Any container with a published port would be reachable from the internet regardless of UFW rules. The DOCKER-USER chain in `/etc/ufw/after.rules` closes this gap with a default-deny approach.
- **no-new-privileges**: Prevents processes inside containers from gaining privileges via setuid/setgid. Set as the default for all containers via daemon.json.
- **userland-proxy disabled**: Eliminates `docker-proxy` processes (one per published port), reducing attack surface. Uses kernel hairpin NAT instead.
- **IP forwarding**: Explicitly enabled in both daemon.json and sysctl (`net.ipv4.ip_forward: 1` in security role) to prevent race conditions.
- Docker group membership grants root-equivalent access (can mount host filesystem, access Docker socket, etc.)
- The docker role grants access only to the `devops` user; application roles (e.g., openclaw) add their own users as needed for container sandbox functionality
- Generic service users in `docker_denied_users` are explicitly removed from docker group on each run
- Docker daemon listens on Unix socket only (no TCP) by default — this must not be changed

## Dependencies

- `common` role
- `security` role (UFW must be configured before Docker adds after.rules)

## Idempotency Notes

- Docker repo addition is idempotent
- Package installation is idempotent (state: present)
- User group management is idempotent
- `gpasswd -d` for non-members returns non-zero; handled with specific `failed_when` condition (only suppresses 'is not a member of' error)
- `blockinfile` for after.rules is idempotent (marker-based)
- daemon.json is always deployed from template; only triggers restart on change
