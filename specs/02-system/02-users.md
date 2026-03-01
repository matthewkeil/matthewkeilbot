# Role Spec: `users`

## Purpose

Create and manage the `devops` admin user and service users (e.g., `matthewkeilbot`). Establishes the privilege separation model: one admin user with sudo, isolated service users with no login and no elevated privileges.

## Role Structure

```
roles/users/
├── tasks/
│   ├── main.yml
│   ├── devops.yml
│   └── service_users.yml
├── defaults/
│   └── main.yml
└── handlers/
    └── main.yml
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `users_devops_name` | `devops_user` or `devops` | |
| `users_devops_ssh_public_key` | `devops_ssh_public_key` | Required — no default |
| `users_devops_shell` | `/bin/bash` | |
| `users_devops_groups` | `[sudo]` | |
| `users_service_accounts` | `service_users` or `[]` | List of `{ name, home }` objects |
| `users_service_shell` | `/usr/sbin/nologin` | |
| `users_service_home_mode` | `0700` | |

## Tasks

### `main.yml`
- Include `devops.yml`
- Include `service_users.yml`

### `devops.yml`
- Create group matching `users_devops_name`
- Create user with primary group set to own group, supplementary groups from `users_devops_groups`, home at `/home/<name>`, shell from `users_devops_shell`
- Set home directory permissions to `0700`, owned by the devops user
- Configure `authorized_keys` using `users_devops_ssh_public_key` with `exclusive: true` (removes any other keys)
- Write `/etc/sudoers.d/<name>` granting passwordless `ALL=(ALL) NOPASSWD:ALL`, validated with `visudo -cf` before deployment, mode `0440`

### `service_users.yml`
- Create a group for each service account (matching the account name)
- Create each service user with: primary group set to own group, shell set to `users_service_shell`, home at the specified path, `system: false`
- Set each service home directory to mode `users_service_home_mode`, owned by that user
- Ensure no sudoers file exists for any service user (explicitly absent)
- Ensure each service user is in only their own group (`append: false`) — removes any accidental group additions including docker

## Design Decisions

- **`exclusive: true` for authorized_keys**: Only the vault-managed key is allowed for devops. Prevents key sprawl.
- **Service users get nologin shell**: They can't SSH in or get an interactive shell. Services run via systemd.
- **Service users not in docker group**: Docker group membership is equivalent to root access. Service users must never have it.
- **`append: false` on service user groups**: Ensures the user is ONLY in their own group, removing any accidental group additions.
- **sudoers validated with `visudo -cf`**: Prevents syntax errors that could lock out sudo access.

## Dependencies

- `common` role (for `acl` package, needed for Ansible `become` to unprivileged users)

## Idempotency Notes

- All user/group tasks are idempotent by nature
- `authorized_key` with `exclusive: true` will remove any manually-added keys on each run
- Sudoers file is validated before deployment, preventing lockout
