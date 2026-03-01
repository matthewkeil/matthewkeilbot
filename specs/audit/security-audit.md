# Security Audit Results

## Ansible Project Specification -- Full Security Audit

**Audit Date**: 2026-03-02
**Scope**: All specification files in `specs/`
**Auditor**: Ansible Security Auditor (Claude Opus 4.6)

---

### CRITICAL-01 -- `host_key_checking = False` Enables Man-in-the-Middle Attacks

- **File**: `specs/01-project-scaffolding.md`, section "ansible/ansible.cfg"
- **Risk**: The spec sets `host_key_checking = False` in `ansible.cfg`. This completely disables SSH host key verification for every Ansible connection. An attacker performing a MITM attack (via ARP spoofing, DNS hijacking, or BGP hijack on a cloud VPS IP) can intercept the SSH connection, capture vault-decrypted secrets (API keys, Tailscale auth tokens), and execute arbitrary commands on the target host. This is especially dangerous because the spec targets cloud VPS providers where the network path traverses the public internet.
- **Remediation**: Replace `host_key_checking = False` with `host_key_checking = accept-new` in `ansible.cfg`. This accepts the host key on first connection but will detect and reject subsequent key changes. For initial bootstrap only, override with `-e ansible_ssh_extra_args='-o StrictHostKeyChecking=no'`.

---

### CRITICAL-02 -- SSH Control Socket in World-Writable `/tmp` Directory

- **File**: `specs/01-project-scaffolding.md`, section "ansible/ansible.cfg"
- **Risk**: The spec sets `control_path = /tmp/ansible-ssh-%%h-%%p-%%r`. SSH ControlMaster sockets placed in `/tmp` are in a world-writable directory. On a multi-user system, another local user can race to create a symlink at the predictable socket path before Ansible does, potentially hijacking the SSH connection or performing local privilege escalation.
- **Remediation**: Use a user-private directory for SSH control sockets. Either remove the line entirely (Ansible 2.3+ generates secure paths automatically) or set `control_path = ~/.ansible/cp/%%h-%%p-%%r`.

---

### CRITICAL-04 -- `deploy-openclaw` Makefile Target Missing `--ask-vault-pass`

- **File**: `specs/06-integration/01-playbooks-and-makefile.md`, section "Makefile Targets"
- **Risk**: The spec states `deploy-openclaw` requires "no vault password." However, `openclaw_port` now resolves to `vault_openclaw_port`, which requires vault decryption. Additionally, the OpenClaw role's `configure.yml` templates the env file with `{{ anthropic_api_key }}` and `{{ telegram_bot_token }}`, which resolve to vault variables. Without vault decryption, these will be undefined.
- **Remediation**: Add `--ask-vault-pass` to the `deploy-openclaw` Makefile target. Note: `ansible_port` is no longer vault-derived (SSH port is in `~/.ssh/config`), but the OpenClaw port and API secrets still require vault access.

---

### HIGH-01 -- `become = True` Applied Globally in `ansible.cfg`

- **File**: `specs/01-project-scaffolding.md`, section "ansible/ansible.cfg"
- **Risk**: Every single task runs as root by default, even when root privileges are not needed. If any task has an injection vulnerability, the attacker gains root execution. The toolchain roles perform downloads and run third-party installers -- all as root. The OpenClaw role explicitly should NOT run as root for most tasks.
- **Remediation**: Remove global `become = True`. Apply `become: true` at the play or task level where root is actually required.

---

### HIGH-02 -- Rust Installer (`sh.rustup.rs`) Downloaded and Executed Without Checksum Verification

- **File**: `specs/04-toolchain/03-rust.md`, section "2. Bootstrap rustup"
- **Risk**: The spec downloads `https://sh.rustup.rs` and executes it with no integrity verification. This installer runs as root (due to global `become = True`) and has full system access. A compromised upstream server or CDN could deliver a malicious installer.
- **Remediation**: Pin a specific version of the `rustup-init` binary from official GitHub releases (which provides per-release SHA256 checksums) rather than the `sh.rustup.rs` shell script. URL: `https://static.rust-lang.org/rustup/archive/{version}/{target}/rustup-init`.

---

### HIGH-03 -- `n` Version Manager Checksum Defaults to Empty String

- **File**: `specs/04-toolchain/01-node.md`, section "Defaults"
- **Risk**: `node_n_checksum` defaults to `""` with a note "must be set in group_vars." There is no assertion that fails when the checksum is empty. An implementer could deploy without integrity verification. The `n` binary runs as root and installs Node.js system-wide.
- **Remediation**: Add an assertion task that fails when the checksum is empty, matching the Zig role's pattern.

---

### HIGH-04 -- Tailscale Auth Key Not Validated as Ephemeral/Pre-authorized

- **File**: `specs/03-services/03-tailscale.md`, section "authenticate.yml"
- **Risk**: A reusable Tailscale auth key stored in vault, if leaked, allows an attacker to join arbitrary devices to the tailnet indefinitely. Once on the tailnet, the attacker can access all services on the Tailscale interface. The `--ssh` flag makes this worse -- an attacker on the tailnet gets SSH access.
- **Remediation**: Modify the playbooks so the Tailscale auth key MUST be configured as ephemeral and single-use. It should be passed with the command line when setting up tailscale for the first time.  document this clearly

---

### HIGH-06 -- `devops` User Has Unrestricted `NOPASSWD: ALL` Sudo

- **File**: `specs/02-system/02-users.md`, section "devops.yml"
- **Risk**: Combined with `AllowTcpForwarding` and `AllowAgentForwarding` enabled in SSH, and Tailscale SSH, there are multiple paths to the devops account. An attacker who compromises the SSH key has instant, passwordless root access. No compensating controls (sudo session logging, MFA on sudo).
- **Remediation**: Accepted risk for single-admin, but add compensating controls: disable TCP and agent forwarding in sshd_config, add auditd rules for sudo execution.

---

### MEDIUM-01 -- node_exporter Binary Downloaded Without Checksum Verification

- **File**: `specs/03-services/04-monitoring.md`, section "node_exporter.yml"
- **Risk**: No checksum verification for the download. A compromised CDN or MITM could substitute a malicious binary.
- **Remediation**: Add a SHA256 checksum variable for the tarball.

---

### MEDIUM-02 -- pyenv Installed via Git Clone Without Integrity Verification

- **File**: `specs/04-toolchain/02-python.md`, section "2. Install pyenv"
- **Risk**: pyenv is installed by cloning at a specific tag with `depth 1`. Git tags are not immutable -- a repository owner can move a tag to a different commit.
- **Remediation**: After cloning, verify the commit hash matches an expected `python_pyenv_commit_sha` variable.

---

### MEDIUM-04 -- `ignore_errors: true` on UFW Tailscale Rule Suppresses Legitimate Failures

- **File**: `specs/02-system/03-security.md`, section "ufw.yml"
- **Risk**: Suppresses ALL errors, not just "interface does not exist." Firewall could be in an inconsistent state without the operator knowing.
- **Remediation**: Use `failed_when` with a specific condition.

---

### MEDIUM-05 -- `fail2ban` Ban Time Too Short (600s / 10 minutes)

- **File**: `specs/02-system/03-security.md`, section "fail2ban defaults"
- **Risk**: An attacker gets 5 attempts every 10 minutes (720 per day). With key-only SSH, practical risk is low, but short bantimes waste resources and create log noise.
- **Remediation**: Increase to at least 3600 seconds. Consider progressive banning.

---

### MEDIUM-06 -- No `Content-Security-Policy` Header in Nginx Security Headers

- **File**: `specs/03-services/02-nginx.md`, section "Defaults"
- **Risk**: Missing CSP and HSTS. The `X-XSS-Protection` header is deprecated in modern browsers.
- **Remediation**: Add CSP and HSTS headers. Remove deprecated `X-XSS-Protection`.

---

### MEDIUM-07 -- Docker Daemon Configuration File Permissions Too Permissive

- **File**: `specs/03-services/01-docker.md`, section "6. Configure Docker daemon"
- **Risk**: `/etc/docker/daemon.json` at mode `0644` is world-readable. Future sensitive config additions would be exposed.
- **Remediation**: Set to mode `0640` with group `docker`.

---

### MEDIUM-08 -- OpenClaw `openclaw_version: "latest"` Creates Non-Reproducible Deployments

- **File**: `specs/05-application/01-openclaw.md`, section "install.yml"
- **Risk**: Every deployment can install a different, untested version. A compromised npm package would be automatically deployed.
- **Remediation**: Pin to exact version. Use separate `make upgrade-openclaw` target.

---

### LOW-01 -- `fact_caching_connection` Points to Relative Path `.ansible_cache`

- **File**: `specs/01-project-scaffolding.md`, section "ansible/ansible.cfg"
- **Risk**: Cached facts (IP addresses, user lists) written without specified permissions. On shared workstation, another user could read them.
- **Suggestion**: Create `.ansible_cache/` with mode `0700`.

---

### LOW-03 -- Audit Log Retention May Be Insufficient

- **File**: `specs/02-system/03-security.md`, section "auditd defaults"
- **Risk**: 50MB x 5 files = 250MB total. Could rotate through in days on active system.
- **Suggestion**: Increase `num_logs` or forward to remote syslog.

---

### LOW-04 -- No Explicit `mode` on Nginx `sites-available` and `sites-enabled` Directories

- **File**: `specs/03-services/02-nginx.md`
- **Risk**: Mode `0755` allows any user to read vhost configs. Future configs with embedded credentials would be exposed.
- **Suggestion**: Consider mode `0750` with group `www-data`.

---

### LOW-05 -- `gpasswd -d` for Docker Group Removal Uses `failed_when: false`

- **File**: `specs/03-services/01-docker.md`, section "5. Manage Docker group membership"
- **Risk**: Suppresses all errors, not just expected "not in group." Service user could remain in docker group (root-equivalent).
- **Suggestion**: Use specific `failed_when` condition.

---

### LOW-06 -- No Log Rotation Configuration for OpenClaw Service

- **File**: `specs/05-application/01-openclaw.md`
- **Risk**: No journal size limits. Logs could grow unbounded.
- **Suggestion**: Configure `LogRateLimitIntervalSec` and `LogRateLimitBurst` in the service unit.

---

### LOW-07 -- Unattended Upgrades Could Break Running Services

- **File**: `specs/02-system/03-security.md`, section "unattended_upgrades.yml"
- **Risk**: Security updates to libraries may require service restarts. `Remove-Unused-Dependencies: true` could remove packages used by manually-installed software.
- **Suggestion**: Add `needrestart` configuration.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 4 | Must fix before deployment |
| **HIGH** | 6 | Should fix promptly |
| **MEDIUM** | 10 | Recommended improvements |
| **LOW** | 7 | Best practice suggestions |

### Critical Items Requiring Immediate Action

1. **CRITICAL-01**: Replace `host_key_checking = False` with `accept-new`
2. **CRITICAL-02**: Move SSH control sockets out of `/tmp`
3. **CRITICAL-03**: Add missing vault variables to vault template
4. **CRITICAL-04**: Add `--ask-vault-pass` to `deploy-openclaw` Makefile target

### Positive Security Observations

- Vault pattern (`vault_` prefix, indirection through `vars.yml`) is well-designed
- `no_log: true` correctly specified on all secret-handling tasks
- systemd security hardening on OpenClaw is comprehensive
- Service user isolation (nologin shell, no docker group, no sudo, `append: false`) is thorough
- SSH hardening (key-only auth, AllowUsers + DenyUsers, custom port, MaxAuthTries=3) is solid
- sshd_config validation with `sshd -t` before deployment prevents lockouts
- Audit rules with `-e 2` immutability flag prevents runtime tampering
- The Zig role demonstrates gold standard for binary downloads (mandatory SHA256 checksum)
