# Best Practices Review: Ansible Project Specs

**Audit Date**: 2026-03-02
**Auditor**: Ansible Best Practices Agent (Claude Opus 4.6)
**Overall Assessment**: APPROVED WITH FINDINGS

This is a well-structured, thoughtfully designed Ansible project. The specs demonstrate strong understanding of Ansible patterns, security-conscious design, and clean separation of concerns. The findings below are areas where the specs can be tightened to prevent implementation problems.

---

## CRITICAL Findings

### CRITICAL-01: `become: True` set globally in `ansible.cfg` violates least-privilege

- **File**: `specs/01-project-scaffolding.md`, "ansible.cfg" section
- **Problem**: The spec sets `become = True` and `become_method = sudo` in the `[privilege_escalation]` section of `ansible.cfg`. This means every single task in every role runs as root by default, even tasks that do not need root (e.g., health checks, version checks, `tailscale status`, `debug` output, `stat` on user-owned files). This is an anti-pattern for two reasons:
  1. It violates the principle of least privilege. A bug in any task has root impact.
  2. It masks missing `become: true` declarations on tasks that actually need it, making roles non-portable. If someone includes one of these roles in a playbook without global `become`, tasks will silently fail.
- **Best Practice**: Remove `become = True` from `ansible.cfg`. Instead, set `become: true` explicitly at the play level in each playbook, or better yet, at the task/block level where privilege is actually needed.
- **Reference**: Ansible documentation recommends using `become` at the task level, rather than the play or global level.

### CRITICAL-02: `ignore_errors: true` on Tailscale UFW rule is an anti-pattern

- **File**: `specs/02-system/03-security.md`, "ufw.yml" section (line 147)
- **Problem**: The spec says to "Allow all traffic on `tailscale0` interface with `ignore_errors: true` (may not exist on first run)." Using `ignore_errors: true` swallows ALL errors, not just the "interface doesn't exist" case. If there is a UFW syntax error, a permissions issue, or any other failure, it will be silently ignored.
- **Best Practice**: Use `failed_when` with a specific condition instead of `ignore_errors: true`. Or better yet, check whether the `tailscale0` interface exists first with a conditional.
- **Reference**: Ansible Lint rule `ignore-errors` -- "Use `failed_when` and specify the acceptable failure conditions."

### CRITICAL-03: `failed_when: false` on docker group removal masks real failures

- **File**: `specs/03-services/01-docker.md`, "Idempotency Notes" section (line 89)
- **Problem**: The spec says `gpasswd -d` for non-members is handled with `failed_when: false`. This suppresses ALL errors from the `gpasswd` command, including actual failures (permission denied, corrupt group file, etc.). The spec should check the specific return code or stderr pattern.
- **Best Practice**: Use `changed_when` and `failed_when` with specific conditions.
- **Reference**: Ansible Lint rules `no-changed-when` and `ignore-errors`.

### CRITICAL-04: `deploy_openclaw.yml` pre_task uses raw command instead of assertion

- **File**: `specs/06-integration/01-playbooks-and-makefile.md`, "deploy_openclaw.yml" section (lines 43-45)
- **Problem**: The spec says the pre_task should "run `node --version` (fail if Node.js is unavailable)". Running a bare command as a pre-check is fragile. It lacks `changed_when: false` (it will always report "changed"), and the failure message from a missing binary is unhelpful ("command not found" vs. "Node.js is required -- run `make toolchain` first").
- **Best Practice**: Use `ansible.builtin.command` with `changed_when: false` and register the result, then use `ansible.builtin.assert` with a descriptive message.

### CRITICAL-05: Toolchain roles use `ansible.builtin.command`/`ansible.builtin.shell` without `changed_when`

- **File**: `specs/04-toolchain/01-node.md`, `specs/04-toolchain/03-rust.md`, `specs/04-toolchain/02-python.md`
- **Problem**: Several command tasks across the toolchain specs lack explicit `changed_when` guidance:
  - Python: `pyenv install` compilation step lacks `changed_when` specification
  - Python: `pyenv global` setting lacks `changed_when: false` (it is a state assertion, not a mutation)
  - All toolchain version verification commands (e.g., `node --version`, `python3 --version`, `rustc --version`, `zig version`) need explicit `changed_when: false`
- **Best Practice**: Every `ansible.builtin.command` or `ansible.builtin.shell` task MUST have either `changed_when` or `creates`/`removes`. This is ansible-lint rule `no-changed-when`.

---

## WARNING Findings

### WARNING-01: Variable indirection pattern creates fragile defaults

- **File**: `specs/02-system/01-common.md`, "Defaults" section; also in `specs/02-system/02-users.md`, `specs/03-services/01-docker.md`, `specs/03-services/04-monitoring.md`
- **Problem**: Throughout the specs, role defaults use patterns like `common_timezone: "{{ system_timezone | default('UTC') }}"`. This is variable indirection -- a role default referencing a group_vars variable. While this technically works due to Ansible's lazy evaluation, it creates problems:
  1. The role's `defaults/main.yml` now has a hidden dependency on an external variable.
  2. Multiple levels of indirection make it hard to trace which value wins.
- **Best Practice**: Role defaults should be concrete, self-contained values. Group_vars should override role defaults through Ansible's natural variable precedence (group_vars > role defaults).

### WARNING-02: Missing `vault_anthropic_api_key` and `vault_telegram_bot_token` from vault contents table

- **File**: `specs/00-overview.md`, "Vault Contents" section
- **Problem**: The vault contents table lists only `vault_ssh_port`, `vault_devops_ssh_public_key`, and `vault_tailscale_auth_key`. However, `vars.yml` references `vault_anthropic_api_key` and `vault_telegram_bot_token`, and `all.yml` asserts they must be defined. The vault template file also omits them. A builder following the vault template will create an incomplete vault.
- **Best Practice**: Remove all references to `vault_anthropic_api_key` and `vault_telegram_bot_token`

### WARNING-03: `host_key_checking = False` in `ansible.cfg` suppresses SSH host key verification

- **File**: `specs/01-project-scaffolding.md`, "ansible.cfg" section (line 16)
- **Problem**: Disabling host key checking permanently is a security concern. While convenient for initial bootstrap, leaving it permanently disabled means Ansible will never detect a man-in-the-middle attack or host key change.
- **Best Practice**: Consider setting `host_key_checking = accept-new` (accepts first connection, alerts on change) or `False` only during bootstrap.

### WARNING-04: Rust role downloads and executes `sh.rustup.rs` without checksum verification

- **File**: `specs/04-toolchain/03-rust.md`, Task 2
- **Problem**: The spec downloads and executes the rustup installer as a shell script with no integrity verification beyond HTTPS. This is a curl-pipe-bash pattern executed with root privileges.
- **Best Practice**: At minimum, use `ansible.builtin.get_url` with `checksum: sha256:...` for a pinned rustup-init binary.

### WARNING-05: Python role's `async: 600` for compilation lacks proper error handling

- **File**: `specs/04-toolchain/02-python.md`, Task 3
- **Problem**: The spec calls for `async: 600` with `poll: 30` for Python compilation but does not mention what happens if the async job fails mid-compilation. An async task that times out leaves orphaned processes.
- **Best Practice**: When using `async`, always register the result and verify completion. Include explicit failure check.

### WARNING-06: No `meta/main.yml` specified for role dependencies

- **File**: All role specs
- **Problem**: Each role spec documents its dependencies in prose but none include `meta/main.yml`. Without it, role dependencies are not enforced by Ansible -- they are only honored by playbook ordering.
- **Best Practice**: Include `meta/main.yml` in each role's structure with `dependencies` declared. This serves as documentation and is enforced by `ansible-lint` and Galaxy.
- **Note**: For this project (single playbook, single host), playbook ordering is sufficient. But `meta/main.yml` provides self-documenting safety. This is a judgment call for the architect.

### WARNING-07: Monitoring role's `node_exporter` download lacks checksum verification

- **File**: `specs/03-services/04-monitoring.md`, "node_exporter.yml" section
- **Problem**: The node_exporter tarball is downloaded from GitHub releases without SHA256 checksum verification. The Zig role correctly requires checksums; the same standard should apply.
- **Best Practice**: Add a `monitoring_node_exporter_checksum` variable and use `ansible.builtin.get_url` with `checksum: sha256:...`.

### WARNING-08: `tailscale_serve_services` in `serve.yml` uses raw command without idempotency guard

- **File**: `specs/03-services/03-tailscale.md`, "serve.yml" section
- **Problem**: The task will always report `changed` unless `changed_when` is properly set by checking the current serve status against the desired state.
- **Best Practice**: Register the current Tailscale Serve status, compare against desired config, and set `changed_when` accordingly.

### WARNING-09: ~~`toolchain` Makefile target marked "no vault password required" but `ansible_port` needs vault~~

**RESOLVED**: `ansible_port` is no longer derived from vault. The SSH port is configured in the operator's `~/.ssh/config`. Only playbooks that use vault secrets (API keys, SSH public key, Tailscale auth key, OpenClaw port) need `--ask-vault-pass`.

---

## SUGGESTION Findings

### SUGGESTION-01: Consider using `import_tasks` vs `include_tasks` explicitly

- **File**: All role specs with split task files
- **Problem**: The specs use the word "include" without specifying whether they mean `ansible.builtin.import_tasks` (static) or `ansible.builtin.include_tasks` (dynamic). This distinction matters:
  - `import_tasks` is preferred for unconditional includes (better for `--list-tasks`, `--syntax-check`).
  - `include_tasks` is required when the include is conditional.
  - The security role's `main.yml` uses feature toggles which requires `include_tasks`.
- **Best Practice**: Explicitly state `import_tasks` for unconditional includes and `include_tasks` for conditional includes.

### SUGGESTION-03: `yamllint` should NOT allow `yes`/`no` truthy values

- **File**: `specs/06-integration/01-playbooks-and-makefile.md`, "YAML Lint Configuration" section
- **Problem**: The yamllint config allows `yes`/`no` as truthy values. This is a well-known YAML gotcha (e.g., `ssh_port: no` parses as boolean `false`). The `ansible-lint` community recommends `true`/`false` only.

### SUGGESTION-04: Consider adding `ansible.builtin.apt_key` deprecation note

- **File**: `specs/03-services/01-docker.md`, `specs/03-services/03-tailscale.md`
- **Problem**: The current spec's approach (downloading to `/etc/apt/keyrings/`) is the correct modern pattern, but it should be explicitly documented that `apt_key` must NOT be used.

### SUGGESTION-05: Zig role should clean up old versions

- **File**: `specs/04-toolchain/04-zig.md`, "Idempotency Notes"
- **Problem**: Old versions accumulate disk usage. Consider a `zig_cleanup_old_versions: false` variable that can be toggled.

### SUGGESTION-06: OpenClaw config deployed only on first run prevents config drift correction

- **File**: `specs/05-application/01-openclaw.md`, "configure.yml" section
- **Problem**: Config is "deployed from template on first deploy only," which means Ansible can never correct config drift or apply template updates. Document that config updates require manual intervention or file deletion + re-run.
- **Best Practice**: Update to check for changes and update config if changed. restart process when config is updated

### SUGGESTION-07: `common` role reboot should explicitly specify `ansible.builtin.reboot` module

- **File**: `specs/02-system/01-common.md`, Task 1
- **Problem**: After the security role changes the SSH port, the reboot module needs to know which port to reconnect on. Explicitly specify the module and note the SSH port consideration.

### SUGGESTION-08: Consider adding `.ansible-lint` configuration file to scaffolding spec

- **File**: `specs/01-project-scaffolding.md`
- **Problem**: Without `.ansible-lint`, `ansible-lint` uses default settings which may conflict with project conventions.
- **Best Practice**: Add .ansible-lint file and insert common configurations that are used for ansible

### SUGGESTION-09: Node role `n` binary checksum defaults to empty string

- **File**: `specs/04-toolchain/01-node.md`, Defaults table
- **Problem**: Unlike the Zig role, which explicitly fails on empty checksum, the Node role does not specify what happens when the checksum is empty.
- **Best Practice**: Add an `ansible.builtin.assert` task that fails if `node_n_checksum` is empty.

### SUGGESTION-10: Security role sysctl and Docker `ip_forward` interaction needs explicit ordering note

- **File**: `specs/02-system/03-security.md`, "sysctl.yml" section
- **Problem**: If the playbook runs `sysctl` after Docker is already running, it sets `ip_forward=0` and immediately breaks Docker container networking. The `changed` status will flip on every run depending on Docker's state.
- **Best Practice**: Either exclude `net.ipv4.ip_forward` from the sysctl params, or add a `changed_when` that accounts for Docker being present.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| WARNING | 10 |
| SUGGESTION | 10 |

### Key Themes

1. **Error handling**: Most common critical issue is `ignore_errors` / `failed_when: false` instead of specific error conditions (CRITICAL-02, CRITICAL-03).
2. **`changed_when` discipline**: Multiple command/shell tasks lack `changed_when`, causing false "changed" reports on every run (CRITICAL-05).
3. **Variable indirection**: Role defaults referencing group_vars creates hidden coupling (WARNING-01).
4. **Vault scope**: Several Makefile targets incorrectly marked as not needing vault access (WARNING-09, WARNING-10).
5. **Checksum consistency**: node_exporter and Node `n` binary should follow the same checksum enforcement pattern as Zig (WARNING-07, SUGGESTION-09).

### What the Specs Do Well

- Clean separation of concerns across roles with well-defined boundaries
- Security-first design with defense-in-depth (UFW + fail2ban + sysctl + auditd)
- Vault variable naming convention (`vault_` prefix) and indirection pattern for templates
- Bootstrap flow is well thought out with correct ordering for the SSH port change problem
- Feature toggles in the security role for flexible hardening
- systemd hardening directives in the OpenClaw service are comprehensive
- `no_log: true` on all secret-handling tasks
- The `sshd -t` validation before deploying SSH config is a critical safety measure
