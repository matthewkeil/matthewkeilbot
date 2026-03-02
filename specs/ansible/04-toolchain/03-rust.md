# Role Spec: `rust`

## Purpose

Install Rust system-wide using rustup. The Rust toolchain is installed to `/opt/rust` and symlinks are created in `/usr/local/bin` so all users have access.

## Role Structure

```
roles/rust/
├── tasks/
│   └── main.yml
├── defaults/
│   └── main.yml
└── meta/
    └── main.yml
```

## Defaults

| Variable | Default | Description |
|---|---|---|
| `rust_rustup_home` | `/opt/rust/rustup` | Directory for rustup metadata and toolchain downloads |
| `rust_cargo_home` | `/opt/rust/cargo` | Directory for cargo binaries and registry |
| `rust_symlink_dir` | `/usr/local/bin` | Directory where Rust tool symlinks are created |
| `rust_toolchain` | `stable` | Rust toolchain channel to install and keep updated |
| `rust_rustup_version` | `1.27.1` | Version of rustup-init binary to download |
| `rust_rustup_checksum` | `""` | SHA256 checksum for the rustup-init binary; must be set in `group_vars`; role will fail if empty |

### Binaries Symlinked to `rust_symlink_dir`

- `rustc`
- `cargo`
- `rustup`
- `rustfmt`
- `clippy-driver`
- `cargo-clippy`
- `cargo-fmt`

## Tasks

### 1. Create Rust directories

- Create `rust_rustup_home` and `rust_cargo_home` directories owned by root, mode `0755`

### 2. Bootstrap rustup (first install only)

- Check whether `{{ rust_cargo_home }}/bin/rustup` exists
- Assert that `rust_rustup_checksum` is non-empty (fail with descriptive message if empty)
- If not present: download the `rustup-init` binary from `https://static.rust-lang.org/rustup/archive/{{ rust_rustup_version }}/x86_64-unknown-linux-gnu/rustup-init` to `/tmp/rustup-init` with SHA256 checksum verification, mode `0755`
- If not present: run `/tmp/rustup-init` with flags `--no-modify-path --default-toolchain {{ rust_toolchain }}`, setting `RUSTUP_HOME` and `CARGO_HOME` environment variables
- Remove the temporary installer file

**Note on rustup checksum**: The `rustup-init` binary is pinned to a specific version and verified with SHA256 checksum. The checksum must be set in `group_vars`. Subsequent toolchain updates go through `rustup update` which verifies signatures internally.

### 3. Update toolchain

- Run `rustup update {{ rust_toolchain }}` with `RUSTUP_HOME` and `CARGO_HOME` set; report changed only when output contains `'updated'` or `'installed'`

### 4. Create symlinks

- Create symlinks for each binary in `rust_symlinks` from `{{ rust_cargo_home }}/bin/{{ item }}` to `{{ rust_symlink_dir }}/{{ item }}`, with `force: true`

### 5. Profile script

- Deploy `/etc/profile.d/rust.sh` owned by root, mode `0644`, exporting `RUSTUP_HOME`, `CARGO_HOME`, and prepending `${CARGO_HOME}/bin` to `PATH`
- Verify the installation by running `rustc --version` via the cargo bin path — use `changed_when: false`
- Display the verified version and cargo home path

## Design Decisions

- **System-wide to /opt/rust**: Both `RUSTUP_HOME` and `CARGO_HOME` are under `/opt/rust`. This keeps all Rust files in one place.
- **Checksummed rustup-init**: The rustup-init binary is version-pinned and SHA256-verified, matching the Zig role's checksum pattern.
- **`--no-modify-path`**: Prevents rustup from modifying shell profiles. We manage PATH via `/etc/profile.d/rust.sh`.
- **Symlinks in /usr/local/bin**: Makes Rust tools available to all users without profile sourcing (useful for systemd services).

## Dependencies

- `common` role (for curl)

## Idempotency Notes

- Bootstrap only runs if rustup binary doesn't exist
- `rustup update` is idempotent (reports "unchanged" if already current)
- Symlinks use `force: true` to handle target changes
