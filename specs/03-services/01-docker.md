# Role Spec: `docker`

## Purpose

Install Docker CE from the official Docker repository. Add the `devops` user to the docker group. Do NOT add service users to the docker group (docker group = root-equivalent access).

## Role Structure

```
roles/docker/
├── tasks/
│   └── main.yml
├── defaults/
│   └── main.yml
└── handlers/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `docker_edition` | `ce` | Community Edition |
| `docker_packages` | docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin | Full plugin stack |
| `docker_users` | `[devops_user \| default('devops')]` | Users granted docker group membership |
| `docker_denied_users` | derived from `service_users` | Users that must never be in docker group |
| `docker_daemon_config` | `{}` | Optional daemon.json overrides |

Optional `docker_daemon_config` overrides (not applied when empty):
- `log-driver`: e.g. `json-file`
- `log-opts.max-size`: e.g. `10m`
- `log-opts.max-file`: e.g. `3`

## Tasks

### 1. Install prerequisites
- Install: ca-certificates, curl, gnupg

### 2. Add Docker GPG key
- Create `/etc/apt/keyrings` directory (mode 0755)
- Download and install Docker GPG key to `/etc/apt/keyrings/docker.gpg`
- Source URL: `https://download.docker.com/linux/ubuntu/gpg`

### 3. Add Docker repository
- Detect system architecture via `dpkg --print-architecture`
- Add signed apt repository for the detected arch and Ubuntu release (stable channel)
- Filename: `docker`

### 4. Install Docker packages
- Install all packages from `docker_packages`
- Run with `update_cache: true`
- Notify handler to restart Docker on change

### 5. Manage Docker group membership
- Add each user in `docker_users` to the `docker` group (append, do not replace)
- For each user in `docker_denied_users`, remove them from the docker group using `gpasswd -d`
- Non-zero exit from `gpasswd -d` (user not in group) is not a failure

### 6. Configure Docker daemon (conditional)
- Write `docker_daemon_config` as JSON to `/etc/docker/daemon.json` (owner root, mode 0644)
- Only applied when `docker_daemon_config` is non-empty
- Notifies handler to restart Docker

### 7. Enable services
- Enable and start `docker` via systemd
- Enable and start `containerd` via systemd

## Handlers

- **Restart docker**: restarts the `docker` systemd service and ensures it remains enabled

## Security Notes

- Docker group membership grants root-equivalent access (can mount host filesystem, access Docker socket, etc.)
- Only the `devops` user should be in the docker group
- Service users are explicitly removed from docker group on each run
- Docker daemon listens on Unix socket only (no TCP) by default — this must not be changed

## Dependencies

- `common` role
- `users` role (service users must exist so we can verify they are not in docker group)

## Idempotency Notes

- Docker repo addition is idempotent
- Package installation is idempotent (state: present)
- User group management is idempotent
- `gpasswd -d` for non-members returns non-zero but is handled with `failed_when: false`
