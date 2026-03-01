# Role Spec: `node`

## Purpose

Install Node.js system-wide using the `n` version manager. Installs `n` to manage Node.js versions, then installs the specified Node.js version. All binaries are available in `/usr/local/bin` for all users.

## Role Structure

```
roles/node/
├── tasks/
│   └── main.yml
└── defaults/
    └── main.yml
```

## Defaults

| Variable | Default | Description |
|---|---|---|
| `node_n_version` | `v10.2.0` (overridable via `n_version`) | Version of the `n` version manager to install |
| `node_n_install_dir` | `/usr/local` | Installation prefix for `n` and Node.js binaries |
| `node_version` | `24` (overridable via `node_version`) | Node.js major version to install |
| `node_n_checksum` | `""` | SHA256 checksum for the `n` binary; must be set in `group_vars` for production |

## Tasks

### 1. Check current versions

- Check current Node.js version (skip install if correct version is already present)
- Check current `n` version (skip install if correct version is already present)

### 2. Install n version manager

- Download the `n` binary from the GitHub releases URL for `node_n_version`, with SHA256 checksum verification; skip if correct version already installed
- Copy the downloaded binary to `{{ node_n_install_dir }}/bin/n` owned by root with mode `0755`; skip if correct version already installed
- Remove the temporary download file

### 3. Install Node.js

- Run `n {{ node_version }}` with `N_PREFIX` set to `node_n_install_dir`; report changed only when output contains `'installed'`
- Verify the resulting `node --version` output
- Display the installed Node.js version and path

### 4. Set up profile script

- Deploy `/etc/profile.d/node.sh` owned by root, mode `0644`, exporting `N_PREFIX` to `node_n_install_dir`

## Design Decisions

- **`n` over `nvm`**: `n` installs Node.js system-wide to `/usr/local/bin`. `nvm` is per-user and requires shell integration. For a shared toolchain, `n` is simpler and cleaner.
- **Checksum verification**: The `n` binary itself is checksummed. Node.js binaries downloaded by `n` are verified by `n` internally.
- **N_PREFIX**: Controls where `n` installs Node.js. Set to `/usr/local` so binaries are in the default PATH.
- **Profile script**: Sets `N_PREFIX` for interactive shells so `n` commands work for the devops user.

## Dependencies

- `common` role

## Idempotency Notes

- Version checks prevent re-installing when correct version is present
- `n` itself handles version checking when installing Node.js
- Profile script only changes on content difference
