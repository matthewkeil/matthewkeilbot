# Role Spec: `users`

## Purpose

Create and manage service users (e.g., `matthewkeilbot`). Establishes the privilege separation model: isolated service users with no login and no elevated privileges.

> **Note:** The `devops` admin user (SSH, sudo, authorized_keys) is now managed by the `bootstrap` role. See [00-bootstrap.md](00-bootstrap.md).

## Role Structure

```
roles/users/
├── tasks/
│   ├── main.yml
│   └── service_users.yml
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
| `users_service_accounts` | `service_users` or `[]` | List of `{ name, home }` objects |
| `users_service_shell` | `/usr/sbin/nologin` | |
| `users_service_home_mode` | `0700` | |

## Tasks

### `main.yml`
- Include `service_users.yml`

### `service_users.yml`
- Create a group for each service account (matching the account name)
- Create each service user with: primary group set to own group, shell set to `users_service_shell`, home at the specified path, `system: false`
- Set each service home directory to mode `users_service_home_mode`, owned by that user
- Ensure no sudoers file exists for any service user (explicitly absent)
- Ensure each service user is in only their own group (`append: false`) — removes any accidental group additions including docker

## Design Decisions

- **Devops user moved to bootstrap role**: Devops user management (SSH key, sudo, authorized_keys) was moved to the `bootstrap` role to support the two-step setup flow (bootstrap then system).
- **Service users get nologin shell**: They can't SSH in or get an interactive shell. Services run via systemd.
- **Service users not in docker group**: Docker group membership is equivalent to root access. Service users must never have it.
- **`append: false` on service user groups**: Ensures the user is ONLY in their own group, removing any accidental group additions.

## Dependencies

- `common` role (for `acl` package, needed for Ansible `become` to unprivileged users)

## Idempotency Notes

- All user/group tasks are idempotent by nature
