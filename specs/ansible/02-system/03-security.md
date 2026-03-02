# Role Spec: `security`

## Purpose

Comprehensive host security hardening. Manages UFW firewall, SSH configuration, fail2ban, kernel sysctl parameters, auditd, shared memory hardening, and unattended security upgrades. Each sub-component is implemented as a separate task file and can be toggled via variables.

## Role Structure

```
roles/security/
├── tasks/
│   ├── main.yml
│   ├── ufw.yml
│   ├── ssh.yml
│   ├── fail2ban.yml
│   ├── sysctl.yml
│   ├── auditd.yml
│   ├── shared_memory.yml
│   ├── proc.yml
│   └── unattended_upgrades.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
├── meta/
│   └── main.yml
└── templates/
    ├── sshd_config.j2
    ├── jail.local.j2
    ├── sysctl-hardening.conf.j2
    ├── audit-rules.j2
    └── 50unattended-upgrades.j2
```

## Defaults

### Feature Toggles

All components are enabled by default and can be individually disabled:

| Variable | Default |
|---|---|
| `security_ufw_enabled` | `true` |
| `security_ssh_enabled` | `true` |
| `security_fail2ban_enabled` | `true` |
| `security_sysctl_enabled` | `true` |
| `security_auditd_enabled` | `true` |
| `security_shared_memory_enabled` | `true` |
| `security_unattended_upgrades_enabled` | `true` |

### SSH

| Variable | Default |
|---|---|
| `security_ssh_port` | `ssh_port` (required) |
| `security_ssh_permit_root_login` | `no` |
| `security_ssh_password_authentication` | `no` |
| `security_ssh_max_auth_tries` | `3` |
| `security_ssh_login_grace_time` | `30` |
| `security_ssh_x11_forwarding` | `no` |
| `security_ssh_allow_users` | `[devops_user or 'devops']` |
| `security_ssh_deny_users` | All names from `service_users` list |

### UFW

| Variable | Default |
|---|---|
| `security_ufw_default_incoming` | `deny` |
| `security_ufw_default_outgoing` | `allow` |

Default rules in `security_ufw_rules`:
- SSH port — `limit` (rate limited), TCP
- Port 80 — `allow`, TCP (HTTP)
- Port 443 — `allow`, TCP (HTTPS)

### fail2ban

| Variable | Default |
|---|---|
| `security_fail2ban_bantime` | `3600` |
| `security_fail2ban_findtime` | `600` |
| `security_fail2ban_maxretry` | `3` |
| `security_fail2ban_ssh_enabled` | `true` |
| `security_fail2ban_nginx_enabled` | `false` |

### sysctl

Default hardening parameters applied to `/etc/sysctl.d/99-hardening.conf`:

IP forwarding (both IPv4 and IPv6):
- `net.ipv4.ip_forward`: not managed by sysctl hardening — removed from the hardening config to avoid breaking Docker networking. Docker manages this setting at daemon startup.
- `net.ipv6.conf.all.forwarding: 0`

ICMP hardening:
- Ignore broadcast pings and bogus error responses
- Disable ICMP redirects (accept and send) for all interfaces, IPv4 and IPv6
- Disable source routing for all interfaces, IPv4 and IPv6

SYN flood protection:
- Enable TCP syncookies
- `tcp_max_syn_backlog: 2048`
- `tcp_synack_retries: 2`

Spoofing protection:
- Reverse path filtering enabled (`rp_filter: 1`) for all interfaces
- Log martian packets on all interfaces

TCP:
- `tcp_rfc1337: 1` — protect against TIME-WAIT assassination

Kernel hardening:
- `kernel.randomize_va_space: 2` — full ASLR
- `kernel.kptr_restrict: 2` — hide kernel pointers
- `kernel.dmesg_restrict: 1` — restrict dmesg to root

### auditd

| Variable | Default |
|---|---|
| `security_auditd_max_log_file` | `50` (MB) |
| `security_auditd_num_logs` | `10` (rotated files to keep) |
| `security_auditd_max_log_file_action` | `rotate` |

### unattended-upgrades

| Variable | Default |
|---|---|
| `security_unattended_upgrades_origins` | `["${distro_id}:${distro_codename}-security"]` |
| `security_unattended_upgrades_auto_reboot` | `false` |

## Tasks

### `main.yml`
Each sub-task file is conditionally included based on its corresponding feature toggle variable.

Execution order (important — see Critical Safety Notes):
1. `ufw.yml`
2. `ssh.yml`
3. `fail2ban.yml`
4. `sysctl.yml`
5. `auditd.yml`
6. `shared_memory.yml`
7. `proc.yml`
8. `unattended_upgrades.yml`

### `ufw.yml`
- Install `ufw` package
- Set default incoming policy to `security_ufw_default_incoming`
- Set default outgoing policy to `security_ufw_default_outgoing`
- Apply all rules from `security_ufw_rules` (rule, port, proto, optional comment)
- Enable UFW

> **Service-owns-config**: The security role has zero knowledge of tailscale, openclaw, or monitoring. Each service role adds its own UFW rules for the `tailscale0` interface (see tailscale, monitoring, and openclaw role specs).

### `ssh.yml`
- Deploy `sshd_config.j2` to `/etc/ssh/sshd_config` (mode `0600`, root owned, backup enabled)
- Validate config with `sshd -t -f %s` before deploying — a malformed config will not be applied
- Notify `Restart sshd` handler

### Template: `sshd_config.j2`
Configures OpenSSH with the following key settings:
- Listens on `security_ssh_port`, both IPv4 and IPv6
- Authentication: public key only (`AuthenticationMethods publickey`), no passwords, no challenge-response
- `AllowUsers` set to `security_ssh_allow_users`; `DenyUsers` set to `security_ssh_deny_users` (if non-empty)
- `PermitRootLogin no`, `PermitEmptyPasswords no`, `StrictModes yes`, `IgnoreRhosts yes`, `HostbasedAuthentication no`
- `MaxAuthTries` and `LoginGraceTime` from defaults
- `X11Forwarding` from defaults; TCP forwarding disabled (`AllowTcpForwarding no`), agent forwarding disabled (`AllowAgentForwarding no`); tunnel not permitted
- Keep-alive: `ClientAliveInterval 300`, `ClientAliveCountMax 2`
- Logging: `SyslogFacility AUTH`, `LogLevel VERBOSE`
- SFTP subsystem disabled

### `fail2ban.yml`
- Install `fail2ban` package
- Deploy `jail.local.j2` to `/etc/fail2ban/jail.local` (mode `0644`, root owned)
- Notify `Restart fail2ban` handler

### Template: `jail.local.j2`
Configures fail2ban with:
- `[DEFAULT]` section: `bantime`, `findtime`, `maxretry` from defaults; `banaction = ufw`
- `[sshd]` jail (when `security_fail2ban_ssh_enabled`): monitors `/var/log/auth.log` on `security_ssh_port`
- `[nginx-http-auth]` jail (when `security_fail2ban_nginx_enabled`): monitors `/var/log/nginx/error.log` on http/https ports

### `sysctl.yml`
- Apply all parameters from `security_sysctl_params` to `/etc/sysctl.d/99-hardening.conf`, reloading immediately

Note on Docker compatibility: Docker manages `net.ipv4.ip_forward` at daemon startup, so it is not included in the sysctl hardening config.

### `auditd.yml`
- Install `auditd` and `audispd-plugins` packages
- Configure `max_log_file`, `num_logs`, and `max_log_file_action` in `/etc/audit/auditd.conf` using `ansible.builtin.lineinfile` (not `ini_file` — auditd requires `key = value` spacing with spaces around `=`)
- Deploy `audit-rules.j2` to `/etc/audit/rules.d/hardening.rules` (mode `0640`, root owned)
- Notify `Restart auditd` handler

### Template: `audit-rules.j2`
Base system audit rules only:
- Write/attribute changes to: `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/gshadow`, `/etc/sudoers`, `/etc/sudoers.d/` (tagged `identity`)
- Write/attribute changes to `/etc/ssh/sshd_config` (tagged `sshd_config`)
- `execve` syscall by root on behalf of users with uid >= 1000 (tagged `privilege_escalation`)
- `chmod`/`fchmod`/`fchmodat` by users with uid >= 1000 (tagged `permission_changes`)
- `chown`/`fchown`/`fchownat`/`lchown` by users with uid >= 1000 (tagged `ownership_changes`)
- Failed `open`/`openat`/`creat` (EACCES and EPERM) by users with uid >= 1000 (tagged `access_denied`)
- Execution of `insmod`, `modprobe`, `rmmod` (tagged `kernel_modules`)
- Write/attribute changes to `/etc/crontab` and `/var/spool/cron/` (tagged `cron_modification`)
- `-e 2` at end — makes audit configuration immutable until reboot

> **Service-owns-config**: Service-specific audit rules (docker, tailscale, openclaw, monitoring) are deployed by each service role as separate files in `/etc/audit/rules.d/`. See docker, tailscale, monitoring, and openclaw role specs.

### `shared_memory.yml`
- Mount `/dev/shm` as `tmpfs` with options: `defaults,noexec,nosuid,nodev`

### `proc.yml`
- Mount `/proc` with `hidepid=invisible` option for system-wide process hiding (prevents non-root users from seeing other users' processes). Ubuntu 24.04 uses `hidepid=invisible` instead of the legacy `hidepid=2`.

### `unattended_upgrades.yml`
- Install `unattended-upgrades`, `apt-listchanges`, and `needrestart` packages (needrestart detects services that need restart after library updates)
- Deploy `50unattended-upgrades.j2` to `/etc/apt/apt.conf.d/50unattended-upgrades` (mode `0644`, root owned)
- Write `/etc/apt/apt.conf.d/20auto-upgrades` to enable: daily package list updates, daily unattended upgrades, weekly autoclean

### Template: `50unattended-upgrades.j2`
Configures:
- `Allowed-Origins` from `security_unattended_upgrades_origins`
- `Automatic-Reboot` from `security_unattended_upgrades_auto_reboot` (default `false`)
- `Remove-Unused-Dependencies: true`
- `Remove-Unused-Kernel-Packages: true`

## Handlers

- `Restart sshd` — restarts and enables `sshd`
- `Restart fail2ban` — restarts and enables `fail2ban`
- `Restart auditd` — restarts auditd using `service auditd restart` (not `systemctl restart` — auditd has `RefuseManualStop=yes` in its systemd unit on Ubuntu 24.04)

## Critical Safety Notes

1. **SSH port change ordering**: UFW must allow the configured SSH port BEFORE sshd changes its listen port. `main.yml` imports `ufw.yml` before `ssh.yml` to enforce this.
2. **sshd_config validation**: The template task uses `validate: "sshd -t -f %s"` to check syntax before deployment. A malformed config will not be deployed.
3. **sshd_config backup**: `backup: true` saves a copy of the previous config, allowing manual recovery if needed.
4. **AllowUsers vs DenyUsers**: Using both provides defense-in-depth. `AllowUsers` is the primary control (whitelist), `DenyUsers` is the secondary control (explicit blacklist for service accounts).
5. **Audit rules immutability**: The `-e 2` rule makes audit configuration immutable until reboot. This prevents an attacker from disabling auditing.

## Dependencies

- `common` role (for `apt` packages)
- Should run AFTER `users` role (so service user names are available for DenyUsers)

## Testing

- After UFW: verify rules include the configured SSH port — `sudo ufw status verbose`
- After SSH: verify no config errors — `sudo sshd -t`; test SSH on new port from a separate session before closing current one
- After fail2ban: verify jails are running — `sudo fail2ban-client status`
- After sysctl: verify settings — `sysctl -a | grep net.ipv4.ip_forward`
- After auditd: verify rules are loaded — `sudo auditctl -l`
- After shared_memory: verify noexec mount — `mount | grep shm`
- After unattended-upgrades: verify config — `apt-config dump | grep Unattended`
