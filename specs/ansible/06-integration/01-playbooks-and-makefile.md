# Integration Spec: Playbooks and Makefile

## Purpose

Wire all roles together into playbooks and provide a Makefile for operator-facing commands.

## Playbooks

### `playbooks/bootstrap_ssh.yml` — First-Time Bootstrap

Runs as root on port 22 against a fresh VPS. Creates the devops user and hardens SSH. After this playbook completes, the host is only accessible as devops on the configured SSH port.

- **pre_tasks**: Assert that `devops_ssh_public_key` is defined and non-empty. Fail with message directing operator to `make vault-edit`.
- **become**: true
- **roles** (in order): `common`, `users`, `security`

### `playbooks/all.yml` — Full Convergence

Runs everything. Used for initial setup and periodic full convergence.

- **pre_tasks**: Assert that `devops_ssh_public_key` is defined and non-empty. Fail with a message directing the operator to `make vault-edit` if missing.
- **become**: true
- **roles** (in order):
  - System layer: `common`, `users`, `security`
  - Services layer: `docker`, `nginx`, `tailscale`, `monitoring`
  - Toolchain layer: `node`, `python`, `rust`, `zig`
  - Application layer: `openclaw`

### `playbooks/setup_system.yml` — System Layer Only

Base system hardening and user setup. First playbook to run on a fresh host (via bootstrap).

- **become**: true
- **pre_tasks**: Assert that `devops_ssh_public_key` is defined and non-empty.
- **roles**: `common`, `users`, `security`

### `playbooks/setup_services.yml` — Services Layer Only

Installs infrastructure services. Assumes `setup_system.yml` has already run successfully.

- **become**: true
- **roles**: `docker`, `nginx`, `tailscale`, `monitoring`

### `playbooks/setup_toolchain.yml` — Toolchain Layer Only

Updates language toolchains without touching anything else.

- **become**: true
- **pre_tasks**: Assert at least 5GB free disk space on `/opt` and `/usr/local` partitions. Fail with descriptive message: 'Insufficient disk space for toolchain installation. At least 5GB free is required.'
- **roles**: `node`, `python`, `rust`, `zig`

### `playbooks/deploy_openclaw.yml` — Deploy OpenClaw

Deploys or updates the OpenClaw bot instance. Assumes system, services, and toolchain layers are already in place.

- **become**: true
- **pre_tasks**: Verify that `node` is on PATH by running `node --version` with `changed_when: false`, register the result. Then assert the result succeeded with descriptive fail message: 'Node.js is not available. Run `make toolchain` before deploying OpenClaw.'
- **roles**: `openclaw`

### `playbooks/update_nginx.yml` — Update Nginx Sites (stub)

Stub for future per-site nginx vhost deployments. Currently a no-op placeholder. Each application needing a public nginx vhost will be wired here as it is added.

### `playbooks/rollback_system.yml` — System Artifact Cleanup

Cleans up stale artifacts that may be left behind by system role changes. Has a Makefile target (`make rollback-system`).

- **become**: true
- **tasks**:
  - Remove stale `LC_ALL` line from `/etc/default/locale` (left by old locale deployment)
  - Fix `auditd.conf` spacing (ensure `key = value` format with spaces around `=`)
  - Remove stale service-specific audit rule files from `/etc/audit/rules.d/` that are no longer managed by their respective roles
  - Restart auditd (via `service auditd restart`)
  - Clean up `sshd_config` backup files

### Rollback Playbooks (manual use only)

Rollback playbooks are provided for critical roles. They do not have Makefile targets and are run directly via `ansible-playbook`:

- `playbooks/rollback_security.yml` -- Reverts SSH config to backup, resets UFW rules to allow port 22
- `playbooks/rollback_openclaw.yml` -- Stops the OpenClaw service, optionally rolls back to a previous npm version

### Note on import_tasks vs include_tasks

All role `main.yml` files use `ansible.builtin.import_tasks` for unconditional task includes and `ansible.builtin.include_tasks` for conditional includes (e.g., security role feature toggles).

## Makefile Targets

The Makefile lives in the `ansible/` directory. All targets prompt for vault password via `--ask-vault-pass` unless noted otherwise.

| Target | Category | Description |
|--------|----------|-------------|
| `help` | Info | Lists all available targets with descriptions |
| `bootstrap` | Setup | First-time VPS bootstrap connecting as root on port 22 (creates devops user, hardens SSH) (`--ask-vault-pass`) |
| `system` | Setup | Runs `setup_system.yml` (system layer only) (`--ask-vault-pass`) |
| `services` | Setup | Runs `setup_services.yml` (services layer only) (`--ask-vault-pass`) (pass `-e tailscale_auth_key=tskey-...` for first-time Tailscale setup) |
| `toolchain` | Setup | Runs `setup_toolchain.yml` (no vault password required) |
| `deploy-openclaw` | Deploy | Runs `deploy_openclaw.yml` (`--ask-vault-pass`) |
| `upgrade-openclaw` | Deploy | Upgrades OpenClaw to latest version (`--ask-vault-pass`) |
| `update-nginx` | Deploy | Runs `update_nginx.yml` stub (no-op for now) |
| `rollback-system` | Rollback | Cleans up stale system artifacts (locale, auditd, audit rules) (`--ask-vault-pass`) |
| `check` | Validation | Syntax-checks all playbooks, then dry-runs `all.yml` with `--check --diff` (`--ask-vault-pass`) |
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
- Truthy values: only `true` and `false` are allowed
- Comments: must start with a space; minimum one space from content
- Indentation: 2 spaces; sequences are indented

## Bootstrap Flow

The bootstrap process handles the chicken-and-egg problem of configuring a fresh host:

```
1. Fresh VPS: root user, SSH on port 22
   └── make bootstrap (connects as root:22, runs bootstrap_ssh.yml)
       ├── common role: installs packages, configures system
       ├── users role: creates devops user + SSH key
       └── security role:
           ├── UFW: allows configured SSH port FIRST
           ├── SSH: changes port to vault_ssh_port, restricts to devops user
           └── (other hardening)
   └── Done: host now only accessible as devops on configured SSH port

2. Operator updates ~/.ssh/config with the new SSH port

3. All subsequent runs: devops user, SSH on configured port (via ~/.ssh/config)
   └── make system / make services / make toolchain / make deploy-openclaw
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
