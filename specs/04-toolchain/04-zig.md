# Role Spec: `zig`

## Purpose

Install Zig from an official checksummed tarball. Extracts to `/opt/zig-{version}` and creates a symlink at `/usr/local/bin/zig`.

## Role Structure

```
roles/zig/
├── tasks/
│   └── main.yml
└── defaults/
    └── main.yml
```

## Defaults

| Variable | Default | Description |
|---|---|---|
| `zig_version` | `0.14.1` (overridable via `zig_version`) | Zig release version to install |
| `zig_install_dir` | `/opt` | Parent directory where the versioned Zig directory is extracted |
| `zig_symlink_dir` | `/usr/local/bin` | Directory where the `zig` symlink is created |
| `zig_checksum` | `""` | SHA256 checksum for the Zig tarball; must be set in `group_vars` for production; role will fail if empty |

### Architecture Mapping

The role uses `ansible_architecture` directly for the Zig download URL — no remapping is needed:

| `ansible_architecture` | Zig arch in tarball name |
|---|---|
| `x86_64` | `x86_64` |
| `aarch64` | `aarch64` |

## Tasks

### 1. Check current version

- Check the currently installed Zig version via `{{ zig_symlink_dir }}/zig version`; treat missing binary as not installed (do not fail)

### 2. Set architecture fact

- Set `zig_arch` from `ansible_architecture` (values pass through unchanged)

### 3. Download and install

All three steps are conditional on the current version being absent or not matching `zig_version`:

- Download `https://ziglang.org/download/{{ zig_version }}/zig-linux-{{ zig_arch }}-{{ zig_version }}.tar.xz` to `/tmp/` with SHA256 checksum verification
- Extract the tarball to `zig_install_dir`; use `creates` to skip if the extracted binary already exists
- Set ownership of the extracted versioned directory to root, mode `0755`

### 4. Create symlink

- Create a symlink at `{{ zig_symlink_dir }}/zig` pointing to the `zig` binary inside the versioned directory, with `force: true`

### 5. Clean up and verify

- Remove the downloaded tarball from `/tmp/`
- Verify the installation by running `{{ zig_symlink_dir }}/zig version`
- Display the verified version and installation path

## Design Decisions

- **Checksummed download**: Zig tarballs are verified with SHA256. The checksum must be set in `group_vars` — the role will fail if it's empty (by design).
- **Extract to versioned directory**: `/opt/zig-linux-{arch}-{version}/` allows multiple versions to coexist. Only one is active via the symlink.
- **No profile script needed**: Zig is a single binary with no environment variables. The `/usr/local/bin/zig` symlink is sufficient.
- **`creates` parameter**: The unarchive step skips extraction if the target binary already exists.

## Dependencies

- `common` role (for `xz-utils` to extract `.tar.xz`)

## Idempotency Notes

- Version check prevents re-downloading when correct version is installed
- `creates` parameter prevents re-extracting
- Symlink uses `force: true` to update on version changes
- Old versions are NOT automatically removed (allows rollback by changing symlink)
