# Project Scaffolding Spec

## Scope

Create the Ansible project skeleton: configuration, dependencies, inventory structure, Makefile, and gitignore.

## Files to Create

### `ansible/ansible.cfg`

```ini
[defaults]
inventory = inventory/hosts.ini
roles_path = roles
remote_user = devops
host_key_checking = accept-new
retry_files_enabled = False
gathering = smart
fact_caching = jsonfile
fact_caching_connection = .ansible_cache
fact_caching_timeout = 3600

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
```

**Notes:**

- `remote_user = devops` — matches the dedicated deploy user
- `host_key_checking = accept-new` — accepts host key on first connection, rejects changes on subsequent connections
- `pipelining = True` — reduces SSH round-trips, requires `requiretty` disabled in sudoers
- `fact_caching` — avoids re-gathering facts on subsequent plays within the same run

### `ansible/requirements.yml`

```yaml
---
collections:
  - name: community.general
    version: ">=9.0.0"
  - name: ansible.posix
    version: ">=1.5.0"
```

**Notes:**

- `community.general` — needed for `community.general.ufw`, `community.general.ini_file`, etc.
- `ansible.posix` — needed for `ansible.posix.sysctl`, `ansible.posix.at`, `ansible.posix.mount`
- No `amazon.aws` needed — this is a non-AWS VPS
- No `community.docker` needed — Docker is installed via apt, not managed via Ansible modules

### `ansible/inventory/hosts.ini`

```ini
[vps]
matthewkeilbot ansible_host=REPLACE_WITH_VPS_IP ansible_user=devops
```

**Notes:**

- `ansible_port` is not set here — the SSH port is configured in the operator's `~/.ssh/config`
- On first run against a fresh host, override with: `ansible-playbook -e ansible_user=root`
  (or whatever the cloud provider's default user is)
- After the security role changes the SSH port, update `~/.ssh/config` to match

### `ansible/inventory/group_vars/all/vars.yml`

```yaml
---
# System
system_timezone: "UTC"
system_locale: "en_US.UTF-8"
system_hostname: "matthewkeilhost"

# SSH (vault_ssh_port is used by the security role to configure sshd, not for Ansible connections)
ssh_port: "{{ vault_ssh_port }}"

# Users
devops_user: "devops"
devops_ssh_public_key: "{{ vault_devops_ssh_public_key }}"

# Service users
service_users:
  - name: "matthewkeilbot"
    home: "/home/matthewkeilbot"

# Tailscale
# tailscale_auth_key: passed via CLI (-e tailscale_auth_key=...) for first-time setup only
tailscale_serve_enabled: true

# OpenClaw
openclaw_version: "latest"
openclaw_port: "{{ vault_openclaw_port }}"
openclaw_bot_name: "matthewkeilbot"
openclaw_user: "matthewkeilbot"
openclaw_home: "/home/matthewkeilbot"
openclaw_sandbox_mode: "container"
openclaw_gateway_bind: "loopback"

# Toolchain versions
node_version: 24
n_version: "v10.2.0"
python3_version: "3.12.8"
pyenv_version: "v2.4.22"
zig_version: "0.14.1"

# Monitoring
monitoring_alert_method: "log"
node_exporter_version: "1.7.0"
```

### `ansible/inventory/group_vars/all/vault.yml`

Template (before encryption):

```yaml
---
vault_ssh_port: 22
vault_devops_ssh_public_key: "ssh-ed25519 AAAA... devops@matthewkeilbot"
vault_openclaw_port: 18789
```

### `ansible/.gitignore`

```
*.retry
.ansible_cache/
*.pyc
__pycache__/
.vault_pass
*.unencrypted
```

**Notes:**

- `.ansible_cache/` — fact cache directory, should be mode 0700

### `ansible/.ansible-lint`

```yaml
---
profile: production
exclude_paths:
  - .ansible_cache/
  - .git/
skip_list: []
```

### `ansible/.yamllint.yml`

```yaml
---
extends: default
rules:
  line-length:
    max: 120
    level: warning
  truthy:
    allowed-values: ['true', 'false']
  comments:
    require-starting-space: true
    min-spaces-from-content: 1
  indentation:
    spaces: 2
    indent-sequences: true
```

### `ansible/Makefile`

See [06-integration/01-playbooks-and-makefile.md](06-integration/01-playbooks-and-makefile.md) for full Makefile spec.

## First-Run Bootstrap Problem

A fresh VPS typically has:

- Root login or a cloud-provided user (e.g., `root`, `ubuntu`)
- SSH on port 22
- No `devops` user

The first Ansible run must bootstrap the devops user and SSH config before subsequent runs can use them. The Makefile should include a `bootstrap` target:

```makefile
bootstrap:  ## First-time bootstrap (run as root/cloud user on port 22)
 ansible-playbook playbooks/all.yml \
  -e ansible_user=root \
  --ask-vault-pass
```

After bootstrap completes, all subsequent runs use the layer-specific targets (e.g., `make system`, `make deploy-openclaw`).

**Critical safety note:** The security role must add the UFW rule for the configured SSH port BEFORE changing the SSH port, and must validate sshd config with `sshd -t` before restarting sshd.

## Testing

- `ansible-playbook --syntax-check playbooks/all.yml`
- `ansible-lint`
- `yamllint .`
- Verify inventory: `ansible-inventory --list`
