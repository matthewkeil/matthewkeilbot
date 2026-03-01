# Role Spec: `tailscale`

## Purpose

Install Tailscale, authenticate to the tailnet, configure UFW for the Tailscale interface, and optionally set up Tailscale Serve to proxy loopback services over HTTPS.

## Role Structure

```
roles/tailscale/
├── tasks/
│   ├── main.yml
│   ├── install.yml
│   ├── authenticate.yml
│   ├── firewall.yml
│   └── serve.yml
├── defaults/
│   └── main.yml
└── handlers/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `tailscale_auth_key` | `vault_tailscale_auth_key \| default('')` | Must come from vault |
| `tailscale_up_args` | `--ssh` | Enables Tailscale SSH |
| `tailscale_auto_update` | `true` | Enables automatic updates |
| `tailscale_minimum_version` | `1.54` | Minimum to avoid TS-2024-001 |
| `tailscale_serve_services` | `[]` | Services to expose via Tailscale Serve |

`tailscale_serve_services` item shape:
- `port`: port number to expose on the tailnet
- `backend`: backend URL (e.g. `http://127.0.0.1:123`)
- `proto`: protocol for Tailscale Serve (default: `https`)

## Tasks

### `main.yml`
- Include `install.yml`
- Include `authenticate.yml`
- Include `firewall.yml`
- Include `serve.yml` only when `tailscale_serve_services` is non-empty

### `install.yml`
- Check whether Tailscale is already installed (via `tailscale version`)
- If not installed: create `/etc/apt/keyrings` directory, add Tailscale GPG key, add Tailscale apt repository
  - GPG key URL: `https://pkgs.tailscale.com/stable/ubuntu/<release>.noarmor.gpg`
  - Repository: stable channel for current Ubuntu release
- Install `tailscale` package (with `update_cache: true`)
- Verify installed version meets `tailscale_minimum_version`; fail with TS-2024-001 advisory message if below minimum
- Enable and start `tailscaled` via systemd

### `authenticate.yml`
- Check current Tailscale status via `tailscale status --json`
- Parse `BackendState` to determine if already authenticated
- Run `tailscale up --authkey=<key> <tailscale_up_args>` only when not already authenticated and `tailscale_auth_key` is set
  - Auth key is never logged (`no_log: true`)
- Enable auto-updates via `tailscale set --auto-update` when `tailscale_auto_update` is true
- Verify `tailscale0` network interface exists (fail if missing)
- Display current `tailscale status` output as debug info

### `firewall.yml`
- Allow all inbound traffic on `tailscale0` interface
- Allow all outbound traffic on `tailscale0` interface

### `serve.yml`
- Verify tailscaled is running (fail if not) before configuring Serve
- Retrieve current Tailscale Serve status
- For each item in `tailscale_serve_services`, run `tailscale serve --<proto>=<port> <backend>`
- Display final `tailscale serve status` output as debug info

## Handlers

- **Restart tailscaled**: restarts the `tailscaled` systemd service and ensures it remains enabled

## Security Notes

- **Auth key is sensitive**: `no_log: true` on the `tailscale up` command to prevent key leakage in logs
- **TS-2024-001**: Minimum version check prevents deployment with a known vulnerability; enforced via assertion with descriptive failure message
- **`--ssh` flag**: Enables Tailscale SSH, allowing SSH access over the tailnet without opening additional ports; this is separate from the system SSH on its configured port
- **UFW integration**: Tailscale traffic is allowed through the firewall on the `tailscale0` interface; any device on the tailnet can reach services bound to the Tailscale IP
- **Tailscale Serve**: Proxies loopback services over HTTPS using Tailscale-managed TLS certificates (Let's Encrypt via Tailscale); no manual certificate management required

## Dependencies

- `common` role
- `security` role (for UFW — though UFW rules can be added independently)

## Idempotency Notes

- Installation check prevents re-downloading on subsequent runs
- Authentication check prevents re-authenticating when already connected
- Tailscale Serve `serve` command is idempotent (re-running with same args is a no-op)
- UFW rule additions are idempotent
