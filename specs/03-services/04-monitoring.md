# Role Spec: `monitoring`

## Purpose

Install Prometheus node_exporter for host metrics and set up a simple cron-based alerting script that checks disk usage, memory, and service health. Metrics are exposed only on the Tailscale interface (or loopback) for security.

## Role Structure

```
roles/monitoring/
├── tasks/
│   ├── main.yml
│   ├── node_exporter.yml
│   └── alerting.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
├── templates/
│   ├── node_exporter.service.j2
│   └── alert-check.sh.j2
└── files/
    └── .gitkeep
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `monitoring_node_exporter_version` | `node_exporter_version \| default('1.7.0')` | |
| `monitoring_node_exporter_listen` | `127.0.0.1:9100` | Loopback only by default |
| `monitoring_node_exporter_user` | `node_exporter` | Dedicated system user |
| `monitoring_disk_warn_percent` | `80` | Disk warning threshold |
| `monitoring_disk_crit_percent` | `90` | Disk critical threshold |
| `monitoring_memory_warn_percent` | `85` | Memory warning threshold |
| `monitoring_alert_method` | `monitoring_alert_method \| default('log')` | `log`, `telegram`, or `email` |
| `monitoring_alert_cron_minute` | `*/5` | Cron schedule (every 5 minutes) |
| `monitoring_watched_services` | see below | Systemd services to monitor |

Default watched services:
- `openclaw@<openclaw_bot_name | default('matthewkeilbot')>`
- `nginx`
- `docker`
- `tailscaled`

## Tasks

### `main.yml`
- Include `node_exporter.yml`
- Include `alerting.yml`

### `node_exporter.yml`
- Create `node_exporter` system user (no login shell, no home directory)
- Check currently installed node_exporter version
- Detect system architecture (amd64 for x86_64, arm64 otherwise)
- Download node_exporter tarball from GitHub releases only when version is missing or outdated
  - Source: `https://github.com/prometheus/node_exporter/releases/download/v<version>/node_exporter-<version>.linux-<arch>.tar.gz`
  - Destination: `/tmp/`
- Extract tarball to `/tmp/`
- Install binary to `/usr/local/bin/node_exporter` (owner root, mode 0755); notify handler on change
- Clean up tarball and extracted directory from `/tmp/`
- Deploy systemd service unit from `node_exporter.service.j2`; notify handler on change
- Enable and start `node_exporter` via systemd (with daemon reload)

### `alerting.yml`
- Create `/opt/monitoring` directory (owner root, mode 0750)
- Deploy `alert-check.sh` from template to `/opt/monitoring/alert-check.sh` (owner root, mode 0750)
- Configure cron job named `monitoring-alert-check` running as root on the `monitoring_alert_cron_minute` schedule

## Templates

### `node_exporter.service.j2`

Systemd unit for node_exporter. Key settings:
- `Type=simple`, runs as `monitoring_node_exporter_user`
- `ExecStart` passes `--web.listen-address` from `monitoring_node_exporter_listen`
- `Restart=on-failure` with 5-second `RestartSec`
- `After=network-online.target`
- Systemd security hardening directives: `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`, `ProtectKernelTunables=true`, `ProtectKernelModules=true`, `ProtectControlGroups=true`

### `alert-check.sh.j2`

Bash script run by cron to check system health. Key behaviors:
- `set -euo pipefail`
- `alert()` function dispatches based on `monitoring_alert_method`; currently `log` method writes to syslog via `logger -t monitoring-alert`; unknown methods also fall back to `logger`
- Disk check: reads `df /` percent used; emits critical alert at `monitoring_disk_crit_percent`, warning at `monitoring_disk_warn_percent`
- Memory check: computes used/total percent from `free`; emits warning at `monitoring_memory_warn_percent`
- Service check: iterates `monitoring_watched_services`; emits critical alert for each service that is not active per `systemctl is-active`

## Handlers

- **Restart node_exporter**: restarts the `node_exporter` systemd service with daemon reload and ensures it remains enabled

## Design Decisions

- **node_exporter binds to loopback**: By default, metrics are only accessible locally. To allow Tailscale access, set `monitoring_node_exporter_listen` to the Tailscale IP or `0.0.0.0:9100` (with UFW restricting access).
- **Cron-based alerting**: Simpler than running Alertmanager. Suitable for a single host. Checks run every 5 minutes by default.
- **Alert method extensible**: Currently only `log` (syslog). Adding Telegram or email requires adding a case to the `alert()` function in the template.
- **Watched services list**: Automatically includes OpenClaw, nginx, docker, tailscaled. Add more as services are deployed.

## Dependencies

- `common` role
- `users` role (service users for node_exporter)

## Idempotency Notes

- Version check prevents re-downloading node_exporter when already installed at the correct version
- Cron job is managed by name, so updates replace the existing entry
- Script deployment is idempotent (only changes on content difference)
