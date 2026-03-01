# Role Spec: `common`

## Purpose

Base system setup on a fresh Ubuntu VPS. Updates packages, installs essential tools, configures timezone, locale, and hostname.

## Role Structure

```
roles/common/
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
| `common_timezone` | `system_timezone` or `UTC` | |
| `common_locale` | `system_locale` or `en_US.UTF-8` | |
| `common_hostname` | `system_hostname` or `inventory_hostname` | |

Default packages installed via `common_packages`:
- `curl`, `wget`, `git`, `jq`, `tree`, `htop`, `unzip`
- `software-properties-common`, `apt-transport-https`, `ca-certificates`, `gnupg`, `lsb-release`
- `acl` — required for Ansible `become` with unprivileged users
- `net-tools`, `iproute2`, `lsof`, `dnsutils`, `rsync`

## Tasks

### 1. Update and upgrade packages
- Update apt cache (`cache_valid_time: 3600`)
- Run `dist-upgrade` with `autoremove` and `autoclean`
- Check for `/var/run/reboot-required`
- Reboot if required (`reboot_timeout: 300`), waiting for SSH to come back before continuing

### 2. Install essential packages
- Install all packages listed in `common_packages`

### 3. Set timezone
- Apply `common_timezone` using the `community.general.timezone` module

### 4. Configure locale
- Generate the locale specified by `common_locale`
- Write `/etc/default/locale` with `LANG` and `LC_ALL` set to `common_locale` (mode `0644`, owned by root)

### 5. Set hostname
- Set the system hostname to `common_hostname`
- Ensure `127.0.1.1 <hostname>` is present in `/etc/hosts`

## Handlers

- `Restart systemd-timesyncd` — restarts and enables `systemd-timesyncd`

## Dependencies

None — this is the first role to run.

## Idempotency Notes

- `apt update` uses `cache_valid_time` to avoid redundant updates
- `dist-upgrade` is idempotent (no-op when all packages are current)
- Hostname and locale tasks are idempotent by nature
- Auto-reboots if required and waits for SSH to come back before continuing
