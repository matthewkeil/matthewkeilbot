# Role Spec: `common`

## Purpose

Base system setup on a fresh Ubuntu VPS. Updates packages, installs essential tools, configures timezone, locale, hostname, vim, and git defaults.

## Role Structure

```
roles/common/
├── tasks/
│   └── main.yml
├── defaults/
│   └── main.yml
├── templates/
│   └── vimrc.j2
├── handlers/
│   └── main.yml
└── meta/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `common_timezone` | `system_timezone` or `UTC` | |
| `common_locale` | `system_locale` or `en_US.UTF-8` | |
| `common_hostname` | `system_hostname` or `inventory_hostname` | |

Default packages installed via `common_packages`:

- **Editors**: `vim`, `nano`
- **Version control**: `git`, `git-lfs`
- **Network tools**: `curl`, `wget`, `netcat-openbsd`, `net-tools`, `dnsutils`, `iputils-ping`, `traceroute`, `tcpdump`, `nmap`, `socat`, `telnet`, `iproute2`
- **Debugging tools**: `strace`, `lsof`, `gdb`, `htop`, `iotop`, `iftop`, `sysstat`, `procps`
- **System utilities**: `tmux`, `tree`, `jq`, `unzip`, `rsync`, `less`
- **Build essentials**: `build-essential`, `file`
- **APT and system infrastructure**: `software-properties-common`, `apt-transport-https`, `ca-certificates`, `gnupg`, `lsb-release`, `acl`

## Tasks

### 1. Update and upgrade packages
- Update apt cache (`cache_valid_time: 3600`)
- Run `dist-upgrade` with `autoremove` and `autoclean`
- Check for `/var/run/reboot-required`
- Warn if reboot is required (manual reboot — no automatic reboots)

### 2. Install essential packages
- Install all packages listed in `common_packages`

### 3. Set timezone
- Apply `common_timezone` using the `community.general.timezone` module

### 4. Configure locale
- Generate the locale specified by `common_locale`
- Check current system locale via `localectl status`
- Apply locale via `localectl set-locale LANG=<common_locale>` (only when not already set). Note: `localectl` does not accept `LC_ALL` — only set `LANG`.

### 5. Set hostname
- Set the system hostname to `common_hostname`
- Ensure `127.0.1.1 <hostname>` is present in `/etc/hosts`

### 6. Vim configuration
- Deploy global vim configuration from `vimrc.j2` template to `/etc/vim/vimrc.local`
- Includes: syntax highlighting, line numbers, 2-space indentation, UTF-8, persistent undo, search settings, split/tab/buffer navigation, filetype-specific overrides (Python 4-space, Go tabs, etc.)

### 7. Git configuration
- Configure global git defaults using `community.general.git_config`:
  - `init.defaultBranch`: `main`
  - `pull.rebase`: `false`
  - `core.editor`: `vim`
  - `color.ui`: `auto`

### 8. Configure journald
- Set `SystemMaxUse=500M` in `/etc/systemd/journald.conf` to limit journal disk usage
- Notify `Restart journald` handler

## Handlers

- `Restart systemd-timesyncd` — restarts and enables `systemd-timesyncd`
- `Restart journald` — restarts `systemd-journald`

## Dependencies

None — this is the first role to run.

## Idempotency Notes

- `apt update` uses `cache_valid_time` to avoid redundant updates
- `dist-upgrade` is idempotent (no-op when all packages are current)
- Hostname and locale tasks are idempotent by nature
- Vim config only changes on template content difference
- Git config module is idempotent (no-op when values already match)
- Warns if reboot is required — does not automatically reboot
