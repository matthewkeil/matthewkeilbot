# Integration Spec: Playbooks and Makefile

## Purpose

Wire all roles together into playbooks and provide a Makefile for operator-facing commands.

## Playbooks

### `playbooks/all.yml` — Full Convergence

Runs everything. Used for initial setup and periodic full convergence.

- **pre_tasks**: Assert that `devops_ssh_public_key`, `tailscale_auth_key`, `anthropic_api_key`, and `telegram_bot_token` are all defined and non-empty. Fail with a message directing the operator to `make vault-edit` if any are missing.
- **roles** (in order):
  - System layer: `common`, `users`, `security`
  - Services layer: `docker`, `nginx`, `tailscale`, `monitoring`
  - Toolchain layer: `node`, `python`, `rust`, `zig`
  - Application layer: `openclaw`

### `playbooks/setup_system.yml` — System Layer Only

Base system hardening and user setup. First playbook to run on a fresh host (via bootstrap).

- **pre_tasks**: Assert that `devops_ssh_public_key` is defined and non-empty.
- **roles**: `common`, `users`, `security`

### `playbooks/setup_services.yml` — Services Layer Only

Installs infrastructure services. Assumes `setup_system.yml` has already run successfully.

- **pre_tasks**: Assert that `tailscale_auth_key` is defined.
- **roles**: `docker`, `nginx`, `tailscale`, `monitoring`

### `playbooks/setup_toolchain.yml` — Toolchain Layer Only

Updates language toolchains without touching anything else. No pre_task assertions required.

- **roles**: `node`, `python`, `rust`, `zig`

### `playbooks/deploy_openclaw.yml` — Deploy OpenClaw

Deploys or updates the OpenClaw bot instance. Assumes system, services, and toolchain layers are already in place.

- **pre_tasks**: Verify that `node` is on PATH by running `node --version` (fail if Node.js is unavailable).
- **roles**: `openclaw`

### `playbooks/update_nginx.yml` — Update Nginx Sites (stub)

Stub for future per-site nginx vhost deployments. Currently a no-op placeholder. Each application needing a public nginx vhost will be wired here as it is added.

## Makefile Targets

The Makefile lives in the `ansible/` directory. All targets prompt for vault password via `--ask-vault-pass` unless noted otherwise.

| Target | Category | Description |
|--------|----------|-------------|
| `help` | Info | Lists all available targets with descriptions |
| `bootstrap` | Setup | First-time full convergence connecting as `root` on port `22` (fresh host) |
| `system` | Setup | Runs `setup_system.yml` (system layer only) |
| `services` | Setup | Runs `setup_services.yml` (services layer only) |
| `toolchain` | Setup | Runs `setup_toolchain.yml` (no vault password required) |
| `deploy-openclaw` | Deploy | Runs `deploy_openclaw.yml` (no vault password required) |
| `update-nginx` | Deploy | Runs `update_nginx.yml` stub (no-op for now) |
| `check` | Validation | Syntax-checks all playbooks, then dry-runs `all.yml` with `--check --diff` |
| `lint` | Validation | Runs `ansible-lint` on all playbooks and `yamllint` on the full tree |
| `vault-edit` | Vault | Opens the encrypted vault file in `$EDITOR` for editing |
| `vault-encrypt` | Vault | Encrypts the plaintext vault file |
| `vault-decrypt` | Vault | Decrypts the vault file (warns operator to re-encrypt when done) |
| `vault-view` | Vault | Displays vault contents without decrypting the file on disk |
| `inventory` | Debug | Prints the full parsed inventory as JSON |
| `ping` | Debug | Runs `ansible.builtin.ping` against the host to test connectivity |
| `facts` | Debug | Gathers and displays all host facts via `ansible.builtin.setup` |
| `deps` | Galaxy | Installs all Ansible Galaxy collections from `requirements.yml` (with `--force`) |

### YAML Lint Configuration

`yamllint` is configured (via `.yamllint.yml`) with the following rules:

- Line length: max 120 characters (warning level, not error)
- Truthy values: `true`, `false`, `yes`, `no` are all allowed
- Comments: must start with a space; minimum one space from content
- Indentation: 2 spaces; sequences are indented

## Bootstrap Flow

The bootstrap process handles the chicken-and-egg problem of configuring a fresh host:

```
1. Fresh VPS: root user, SSH on port 22
   └── make bootstrap (connects as root:22)
       ├── common role: installs packages
       ├── users role: creates devops user + SSH key
       ├── security role:
       │   ├── UFW: allows configured SSH port FIRST
       │   ├── SSH: changes port to vault_ssh_port, restricts to devops user
       │   └── (other hardening)
       ├── ... (remaining roles)
       └── Done: host now only accessible as devops on configured SSH port

2. All subsequent runs: devops user, SSH on configured port (via ~/.ssh/config)
   └── make setup / make deploy-openclaw (uses ansible.cfg defaults)
```

**Critical**: If bootstrap fails mid-way through the security role (after SSH port change but before UFW allows the new port), the host may become inaccessible. The security role prevents this by:

1. Adding UFW rules before changing SSH config.
2. Validating `sshd_config` with `sshd -t` before deploying.
3. Keeping a backup of the previous `sshd_config`.

## Testing

- `make check` — syntax-checks all playbooks, then dry-runs against the host
- `make lint` — lints all YAML files
- `make ping` — basic connectivity check before running playbooks
- Always run against a disposable test VPS before applying to production
