# Role Spec: `tailscale`

## Purpose

Install Tailscale, authenticate to the tailnet, and configure base UFW rules for the Tailscale interface. Service-specific UFW rules and Tailscale Serve configuration are owned by each consuming role (see openclaw, monitoring role specs).

## Role Structure

```
roles/tailscale/
├── tasks/
│   ├── main.yml
│   ├── install.yml
│   ├── authenticate.yml
│   └── firewall.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
└── meta/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `tailscale_auth_key` | `''` | Passed via CLI (`-e tailscale_auth_key=...`) for first-time setup. NOT stored in vault. |
| `tailscale_up_args` | `--ssh` | Enables Tailscale SSH |
| `tailscale_auto_update` | `true` | Enables automatic updates |
| `tailscale_minimum_version` | `1.54` | Minimum to avoid TS-2024-001 |

## Tasks

### `main.yml`
- Import `install.yml`
- Import `authenticate.yml`
- Include `firewall.yml` — conditional on `tailscale_interface.stat.exists` (set by authenticate.yml). Skipped if Tailscale is not authenticated.
- Deploy Tailscale audit rules to `/etc/audit/rules.d/tailscale.rules` (watches `/var/lib/tailscale/`, tagged `tailscale_config`). Notify `Reload audit rules` handler.

### `install.yml`
- Check whether Tailscale is already installed (via `tailscale version`)
- If not installed: create `/etc/apt/keyrings` directory, add Tailscale GPG key, add Tailscale apt repository
  - Note: Do NOT use the deprecated `ansible.builtin.apt_key` module.
  - GPG key URL: `https://pkgs.tailscale.com/stable/ubuntu/<release>.noarmor.gpg`
  - Repository: stable channel for current Ubuntu release
- Install `tailscale` package (with `update_cache: true`)
- Verify installed version meets `tailscale_minimum_version`; fail with TS-2024-001 advisory message if below minimum
- Enable and start `tailscaled` via systemd

### `authenticate.yml`
- Check current Tailscale status via `tailscale status --json`
- Parse `BackendState` to determine if already authenticated
- If `NeedsLogin` and no `tailscale_auth_key` provided: display a warning (not a failure) instructing the operator to pass `-e tailscale_auth_key=tskey-...`. The rest of the playbook continues — firewall tasks are skipped since `tailscale0` won't exist.
- Run `tailscale up --authkey=<key> <tailscale_up_args>` only when `NeedsLogin` and `tailscale_auth_key` is non-empty.
  - Auth key is never logged (`no_log: true`)
- If the `tailscale up` command fails (e.g., expired or invalid key), fail with a descriptive message: 'Tailscale authentication failed. The auth key may be expired or invalid. Generate a new ephemeral, single-use key from the Tailscale admin console.'
- Enable auto-updates via `tailscale set --auto-update` when `tailscale_auto_update` is true
- Check `tailscale0` network interface exists. If missing, display a warning (not a failure) — downstream tasks (firewall.yml) are gated on this check.
- Display current `tailscale status` output as debug info

### `firewall.yml`
Base tailscale0 firewall rules only:
- Allow SSH (22/tcp) on `tailscale0` interface
- Allow HTTPS (443/tcp) on `tailscale0` interface (for Tailscale Serve)
- Allow all outbound traffic on `tailscale0` interface

> **Service-owns-config**: The tailscale role has zero knowledge of openclaw or monitoring. Each consuming role adds its own UFW rules for the `tailscale0` interface (e.g., monitoring adds 9100/tcp, openclaw adds its port). Tailscale Serve configuration is owned by the openclaw role.

## Handlers

- **Restart tailscaled**: restarts the `tailscaled` systemd service and ensures it remains enabled
- **Reload audit rules**: restarts auditd using `service auditd restart` (auditd has `RefuseManualStop=yes` on Ubuntu 24.04)

## Security Notes

- **Auth key is sensitive**: `no_log: true` on the `tailscale up` command to prevent key leakage in logs
- **TS-2024-001**: Minimum version check prevents deployment with a known vulnerability; enforced via assertion with descriptive failure message
- **`--ssh` flag**: Enables Tailscale SSH, allowing SSH access over the tailnet without opening additional ports; this is separate from the system SSH on its configured port
- **UFW integration**: Tailscale traffic is allowed through the firewall on the `tailscale0` interface; any device on the tailnet can reach services bound to the Tailscale IP
- **Tailscale Serve**: Proxies loopback services over HTTPS using Tailscale-managed TLS certificates (Let's Encrypt via Tailscale); no manual certificate management required
- **Ephemeral auth keys**: The Tailscale auth key should be configured as ephemeral and single-use in the Tailscale admin console. It is passed via command line, NOT stored in vault, to minimize exposure.

## Dependencies

- `common` role
- `security` role (for UFW — though UFW rules can be added independently)

## Idempotency Notes

- Installation check prevents re-downloading on subsequent runs
- Authentication check prevents re-authenticating when already connected
- UFW rule additions are idempotent
