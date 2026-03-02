# Role Spec: `openclaw`

## Purpose

Install and configure a single OpenClaw bot instance. Handles: OpenClaw CLI installation via npm, configuration file generation, environment file with secrets from vault, systemd service with comprehensive security hardening, Tailscale Serve integration for HTTPS access, and health checking.

## Role Structure

```
roles/openclaw/
├── tasks/
│   ├── main.yml
│   ├── install.yml
│   ├── configure.yml
│   ├── systemd.yml
│   ├── tailscale_serve.yml
│   └── health_check.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
├── meta/
│   └── main.yml
└── templates/
    ├── openclaw@.service.j2
    ├── openclaw-env.j2
    └── openclaw-config.json5.j2
```

## Defaults

| Variable | Default | Notes |
|----------|---------|-------|
| `openclaw_version` | `latest` | npm package version to install |
| `openclaw_bot_name` | `matthewkeilbot` | systemd instance name (`openclaw@<name>`) |
| `openclaw_user` | `matthewkeilbot` | OS user running the service |
| `openclaw_home` | `/home/matthewkeilbot` | Service user home directory |
| `openclaw_port` | (from vault via `vault_openclaw_port`) | Gateway listen port (loopback only) |
| `openclaw_gateway_bind` | `loopback` | Gateway bind address |
| `openclaw_sandbox_mode` | `container` | Agent sandbox mode |
| `openclaw_generate_auth_token` | `true` | Whether to generate a gateway auth token on first deploy |
| `openclaw_discovery_mdns` | `off` | mDNS discovery mode |
| `openclaw_log_redact_sensitive` | `tools` | Log redaction scope |
| `openclaw_max_processes` | `150` | systemd `LimitNPROC` |
| `openclaw_max_open_files` | `8192` | systemd `LimitNOFILE` |
| `openclaw_restart_sec` | `10` | Seconds before restart on failure |
| `openclaw_start_limit_interval` | `300` | Window for start limit burst counting |
| `openclaw_start_limit_burst` | `5` | Max restarts within interval |
| `openclaw_tailscale_serve` | `true` | Whether to configure Tailscale Serve |
| `openclaw_health_check_retries` | `5` | Health check retry count |
| `openclaw_health_check_delay` | `5` | Seconds between health check retries |

## Tasks

### `main.yml`

Orchestrates the task files in order: install, configure, systemd, tailscale_serve (conditional on `openclaw_tailscale_serve`), health_check. At the end, register the service with monitoring by adding `openclaw@{{ openclaw_bot_name }}` to the `monitoring_watched_services` list (append, do not replace).

### `install.yml`

- Checks if OpenClaw is already installed and at the expected version before acting.
- Installs via `npm install -g openclaw@<version>` using the system Node.js (`N_PREFIX=/usr/local`).
- When version is `latest`, runs `npm update -g openclaw` and detects changes from stdout.
- Notifies the `Restart openclaw` handler on any install or update.
- Verifies installation by running `openclaw --version` after install.

### `configure.yml`

- Creates `~/.openclaw/` config directory (mode `0700`, owned by service user).
- Auth token: generates a 32-byte hex token via `openssl rand -hex 32` on first deploy only; reads and re-uses the existing token on subsequent runs. Token is stored at `~/.openclaw/gateway-token` (mode `0600`).
- Config file (`config.json5`): deployed from template. On each run, compare the template output with the existing config file. If changed, update the config and notify `Restart openclaw` handler. This ensures Ansible can correct config drift while also applying template updates.
- Env file (`env`): always updated from template on every run. Triggers `Restart openclaw` handler.
- All secret-handling steps use `no_log: true`.

### `systemd.yml`

- Deploys the `openclaw@.service` template to `/etc/systemd/system/` (mode `0644`, owned by root).
- Triggers `Reload systemd` and `Restart openclaw` handlers on change.
- Flushes handlers immediately to ensure systemd reload happens before enabling the service.
- Enables and starts `openclaw@<bot_name>`.

### `tailscale_serve.yml`

- Checks Tailscale backend state before acting (skips silently if Tailscale is not running).
- Configures Tailscale Serve to proxy HTTPS on the configured port to `http://127.0.0.1:<port>`.
- Only runs when `openclaw_tailscale_serve` is true.

### `health_check.yml`

- Polls `http://127.0.0.1:<port>/` until HTTP 200 or 302 is returned.
- Retries up to `openclaw_health_check_retries` times with `openclaw_health_check_delay` seconds between attempts.
- Displays deployment summary (service name, port, status, access method) on success.

## Templates

### `openclaw@.service.j2`

Systemd template unit for a bot instance (parameterized by `%i`/`openclaw_bot_name`). Configures:

- Service type `simple`, running as the service user.
- Working directory set to `openclaw_home`.
- Environment variables: `NODE_ENV=production`, paths for pyenv, cargo, rustup, go, and go cache; plus an `EnvironmentFile` pointing to the env file.
- ExecStart: `openclaw gateway --port ${OPENCLAW_PORT}`.
- Restart policy: `on-failure` with configurable `RestartSec` and start limit burst.
- Resource limits: `LimitNOFILE` and `LimitNPROC` from defaults.
- `LogRateLimitIntervalSec=30s`, `LogRateLimitBurst=1000` -- prevents excessive logging from filling the journal.
- All systemd security hardening directives listed in the table below.

### `openclaw-env.j2`

Sets the environment variable for the service: `OPENCLAW_PORT` -- the configured port. Deployed to `~/.openclaw/env`, mode `0600`, owned by service user. Always updated on every run.

### `openclaw-config.json5.j2`

Initial gateway configuration in JSON5 format. Deployed only on first install (not overwritten). Configures:

- Gateway bind address, port, and token-based auth (using the generated/stored token).
- Control UI enabled.
- Agent sandbox mode.
- mDNS discovery mode.
- Log redaction scope.

## Handlers

- `Reload systemd` — runs `daemon_reload` on the systemd module.
- `Restart openclaw` — restarts `openclaw@<bot_name>` via systemd and ensures it remains enabled.

## Security Notes

### systemd Hardening

| Directive | Purpose |
|-----------|---------|
| `NoNewPrivileges=true` | Process cannot gain new privileges via setuid/setgid |
| `ProtectSystem=strict` | Makes /usr, /boot, /efi read-only |
| `ProtectHome=tmpfs` | Replaces /home with empty tmpfs (except BindPaths) |
| `BindPaths` + `ReadWritePaths` | Only the bot's home directory is writable |
| `PrivateTmp=true` | Private /tmp namespace per service |
| `ProtectKernel*` | Prevents modifying kernel tunables, loading modules, accessing cgroups |
| `ProtectClock=true` | Prevents setting system clock |
| `RestrictNamespaces=true` | Prevents creating new namespaces (container escape prevention) |
| `CapabilityBoundingSet=` | Empty = no Linux capabilities at all |
| `ProtectProc=invisible` | Hides other users' processes in /proc |
| `RestrictAddressFamilies` | Only IPv4, IPv6, and Unix sockets allowed |
| `SystemCallFilter` | Whitelist system-service calls, deny privileged/resources/mount |
| `MemoryDenyWriteExecute=false` | **Required**: Node.js V8 JIT needs writable+executable memory |

### Secrets Handling

- Auth token stored in `gateway-token` file (mode `0600`).
- Env file (mode `0600`).
- All secret-touching tasks use `no_log: true`.
- Config file deployed from template on every run; updated if changed (corrects drift).

## Dependencies

- `users` role (service user must exist)
- `node` role (Node.js + npm must be installed)
- `tailscale` role (for Tailscale Serve integration)

## Idempotency Notes

- OpenClaw install checks version before re-installing.
- Config file deployed from template on every run; updated only if changed.
- Env file always updated on every run.
- Auth token only generated on first deploy; subsequent runs read the existing token.
- systemd service template is idempotent.
- Health check runs every time (verification, not mutation).
