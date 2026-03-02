# Role Spec: `bootstrap`

## Purpose

First-time VPS bootstrap. Creates the `devops` admin user with SSH key authentication and passwordless sudo, then changes the SSH port. This role runs once on a bare Ubuntu VPS (as root on port 22) to establish the initial admin access needed for all subsequent Ansible operations.

After bootstrap, operators must run `make system` to apply full security hardening (UFW, SSH lockdown, fail2ban, sysctl, auditd).

## Role Structure

```
roles/bootstrap/
├── tasks/
│   └── main.yml
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
| `bootstrap_devops_name` | `devops_user` or `devops` | References global `devops_user` variable |
| `bootstrap_devops_ssh_public_key` | `devops_ssh_public_key` | Required — no default |
| `bootstrap_devops_shell` | `/bin/bash` | |
| `bootstrap_devops_groups` | `[sudo]` | |
| `bootstrap_ssh_port` | `ssh_port` | Required — must be 1024-65535 |

## Tasks

### 1. Assert required variables are configured
- Validates `bootstrap_devops_ssh_public_key` is defined and non-empty
- Validates `bootstrap_ssh_port` is defined and within range 1024-65535
- Fails fast before any system changes if variables are missing or invalid
- Defense-in-depth: the `bootstrap_ssh.yml` playbook also has pre_tasks assertions for the global variables

### 2. Update apt cache
- Runs `apt update` with `cache_valid_time: 3600`

### 3. Install acl package
- Installs the `acl` package required for Ansible `become` with unprivileged users
- Intentional duplication with the `common` role — bootstrap runs on a bare VPS without the common role

### 4. Create devops group
- Creates a group matching `bootstrap_devops_name`

### 5. Create devops user
- Creates user with primary group set to own group, supplementary groups from `bootstrap_devops_groups`, home at `/home/<name>`, shell from `bootstrap_devops_shell`

### 6. Set devops home directory permissions
- Sets home directory to mode `0700`, owned by the devops user

### 7. Validate SSH public key format
- Runs `ssh-keygen -l -f` on the provided key to verify format validity
- Delegates to localhost (does not require the key on the remote host)
- Prevents lockout from a malformed key
- Uses `no_log: true` to protect key material

### 8. Configure devops authorized_keys
- Deploys the SSH public key with `exclusive: true` (removes any other keys)
- Uses `no_log: true` to protect key material

### 9. Configure devops passwordless sudo
- Writes `/etc/sudoers.d/<name>` granting `ALL=(ALL) NOPASSWD:ALL`
- Validated with `visudo -cf` before deployment
- Mode `0440`, owned by root

### 10. Change SSH port
- Modifies `/etc/ssh/sshd_config` to set `Port` to `bootstrap_ssh_port`
- Validated with `sshd -t -f` before applying
- Notifies `Restart sshd (bootstrap)` handler

### 11. Flush handlers
- Forces the `Restart sshd (bootstrap)` handler to run immediately so the SSH port change takes effect before verification

### 12. Verify SSH is listening on new port
- Uses `wait_for` to confirm the new SSH port is accepting connections
- Timeout of 30 seconds with a 2-second initial delay

### 13. Post-bootstrap security reminder
- Prints a debug message reminding the operator to run `make system` for full hardening

## Design Decisions

- **Zero dependencies (no common role)**: Bootstrap must work on a completely bare VPS. The `acl` package is installed directly rather than relying on the common role's package list. When `make system` later runs the common role, the acl install becomes a no-op.
- **Only changes SSH port, not other sshd settings**: The role only sets the `Port` directive. `PermitRootLogin` and `PasswordAuthentication` remain at Ubuntu defaults so root can still connect if the devops user has issues. Full SSH hardening is deferred to the security role (run via `make system`).
- **`regexp: '^#?Port\s'` handles both active and commented Port directives**: Whether the stock config has `Port 22` or `#Port 22`, the lineinfile regexp matches and replaces it.
- **`validate: "sshd -t -f %s"` on lineinfile**: Prevents a bad sshd_config from being written. If the generated config fails validation, the task fails and the original config is preserved.
- **`exclusive: true` on authorized_keys**: Only the vault-managed key is accepted. Prevents key sprawl from manual additions.
- **`no_log: true` on SSH key tasks**: Protects key material from appearing in Ansible output or logs.
- **`visudo -cf` validation on sudoers**: Prevents syntax errors that could lock out sudo access entirely.
- **Post-bootstrap debug warning**: Reminds the operator to run `make system` promptly, since the server is on a non-standard port but NOT hardened.

## Handlers

- `Restart sshd (bootstrap)` -- restarts and enables `sshd`. Named distinctly from the security role's `Restart sshd` handler to avoid global handler namespace collisions.

## Dependencies

None -- this is intentionally a standalone role with zero dependencies. It must work on a completely bare VPS where no other roles have run.

## Idempotency Notes

- All user/group tasks are idempotent by nature
- `authorized_key` with `exclusive: true` will remove any manually-added keys on each run
- The SSH port `lineinfile` task is idempotent (no-op if the port is already set)
- Sudoers file is validated before deployment, preventing lockout
- The `acl` package install is a no-op if already present (duplicated intentionally with the `common` role)

## Security Considerations

- The role runs with `become: true` as root -- all tasks execute with full privilege.
- **Security gap between bootstrap and system**: After bootstrap completes but before `make system` runs, `PermitRootLogin=yes` and `PasswordAuthentication=yes` remain at Ubuntu defaults. The server is on a non-standard SSH port but is NOT hardened. Operators MUST run `make system` promptly after bootstrap.
- The SSH port change happens last, after the devops user is fully configured, to prevent a partial bootstrap from leaving the server inaccessible.
- `exclusive: true` on `authorized_keys` ensures only the vault-managed key is accepted.
- The SSH key is validated locally before deployment to prevent lockout from a malformed key.
- `no_log: true` is used on tasks handling SSH key material to prevent exposure in logs.
