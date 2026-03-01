# Linux Security Audit Results

**Audit Date**: 2026-03-02
**Audit scope**: All spec files in `specs/`
**Target**: Ubuntu 24.04 LTS VPS, single-host deployment
**Operational context**: Managed server operated by a single trusted DevOps admin
**Auditor**: Linux Security Auditor (Claude Opus 4.6)

---

### CRITICAL-01 -- OpenClaw Sandbox Mode Disabled Allows Unrestricted Agent Code Execution

- **Spec file**: `specs/01-project-scaffolding.md` (line 105: `openclaw_sandbox_mode: "off"`) and `specs/05-application/01-openclaw.md` (line 38)
- **Affected hosts**: All VPS hosts running the `matthewkeilbot` OpenClaw instance
- **Attack path**:
  1. OpenClaw runs with `sandbox_mode: "off"`, meaning the AI agent can execute arbitrary commands on the host via tools.exec without sandboxing.
  2. The agent runs as the `matthewkeilbot` service user with a writable home directory via `BindPaths`.
  3. Prompt injection via untrusted content the bot processes can instruct the agent to execute arbitrary commands.
  4. While systemd hardening restricts the environment (no capabilities, read-only system paths, restricted syscalls), the agent has full read/write access to its home directory and can execute any binary in PATH (node, python, rust toolchain, etc.).
  5. The `.openclaw/env` file (mode `0600`) contains `ANTHROPIC_API_KEY` and `TELEGRAM_BOT_TOKEN` -- the agent process can read these, and prompt injection could exfiltrate them.
- **Impact**: Arbitrary command execution within the service user's systemd sandbox. API key and Telegram token exfiltration. Data destruction within the bot's home directory. systemd hardening limits blast radius significantly.
- **Remediation**: Set `openclaw_sandbox_mode` to a sandboxed mode to `"container"`. If compatible use `"audit"` mode to log exec operations.

---

### CRITICAL-02 -- Docker Group Membership Grants devops User Root-Equivalent Access

- **Spec file**: `specs/03-services/01-docker.md` (lines 25-26: `docker_users` defaults to `[devops]`)
- **Affected hosts**: All VPS hosts
- **Attack path**:
  1. The `devops` user is added to the `docker` group.
  2. Any process running as `devops` can run: `docker run -v /:/mnt --rm -it alpine chroot /mnt sh`
  3. This mounts the entire host filesystem and provides an unrestricted root shell.
  4. The attacker can then modify `/etc/shadow`, install rootkits, read all secrets, or pivot to other networks.
- **Impact**: Docker group membership is functionally equivalent to unrestricted root access.
- **Risk assessment**: The spec correctly identifies this risk and prevents service users from joining docker. The `devops` user already has `NOPASSWD:ALL` sudo, so docker group membership does not *increase* the privilege ceiling. However, it provides an additional root escalation path that bypasses auditd sudo monitoring.
- **Remediation**: Since `devops` already has full sudo, this is architecturally acceptable. To maintain defense-in-depth and ensure all root-equivalent actions are auditable:
  - Accept risk but add auditd rule for docker socket: `-w /var/run/docker.sock -p rwxa -k docker_access`

---

### HIGH-02 -- UFW Allows ALL Traffic on tailscale0 Interface

- **Spec file**: `specs/02-system/03-security.md` (line 147) and `specs/03-services/03-tailscale.md` (lines 65-66)
- **Affected hosts**: All VPS hosts
- **Risk**: Two separate locations configure `ufw allow in on tailscale0`. This grants unrestricted port access to every device on the tailnet. If the tailnet has multiple users or shared nodes, all can reach every listening port (node_exporter 9100, OpenClaw on its vault-configured port, Docker socket if exposed, etc.).
- **Remediation**: Replace blanket allow with port-specific rules:
  - Port 22/tcp: Tailscale SSH (if enabled)
  - Port 9100/tcp: node_exporter
  - Port 443/tcp: Tailscale Serve HTTPS
  - Port `{vault_openclaw_port}`/tcp: Openclaw UI port

---

### HIGH-03 -- Ansible host_key_checking Disabled Enables MITM Attacks

- **Spec file**: `specs/01-project-scaffolding.md` (line 16: `host_key_checking = False`)
- **Affected hosts**: Ansible control machine connecting to all managed hosts
- **Risk**: Ansible will connect to any host presenting any SSH key without verification. MITM attacker can intercept the connection and receive vault-decrypted secrets.
- **Remediation**: Use `accept-new` instead of `False`, and pre-populate `known_hosts` after initial bootstrap.

---

### MEDIUM-01 -- Rustup Bootstrap Uses Unverified curl-pipe-sh Pattern

- **Spec file**: `specs/04-toolchain/03-rust.md` (lines 45-49)
- **Affected hosts**: All VPS hosts during toolchain setup
- **Risk**: The rustup installer is downloaded and executed as root without checksum verification. While HTTPS provides transport-level integrity, it does not protect against CDN compromise or supply chain attacks.
- **Remediation**: Pin a specific SHA256 checksum and verify before executing. Or use the standalone `rustup-init` binary with published checksums.

---

### MEDIUM-02 -- Node.js n Version Manager Checksum Not Enforced

- **Spec file**: `specs/04-toolchain/01-node.md` (line 24: `node_n_checksum: ""`)
- **Affected hosts**: All VPS hosts during toolchain setup
- **Risk**: Empty checksum default with no enforcement. The `n` binary is downloaded from GitHub and installed as root without integrity verification.
- **Remediation**: Add assertion task that fails if checksum is empty.

---

### MEDIUM-03 -- MemoryDenyWriteExecute Disabled for OpenClaw Service

- **Spec file**: `specs/05-application/01-openclaw.md` (line 151: `MemoryDenyWriteExecute=false`)
- **Affected hosts**: All VPS hosts running OpenClaw
- **Risk**: Allows writable+executable memory regions. Required for Node.js V8 JIT compilation. Combined with sandbox mode off, the attack surface is wider.
- **Risk assessment**: This is a necessary tradeoff for Node.js. The other systemd hardening directives significantly reduce exploitability. No direct fix is possible while running Node.js.

---

### MEDIUM-04 -- fail2ban bantime of 600 Seconds Is Short

- **Spec file**: `specs/02-system/03-security.md` (line 78)
- **Affected hosts**: All VPS hosts
- **Risk**: 720 password attempts per day. With key-only SSH, practical risk is low. Primary concern is log noise.
- **Remediation**: Increase to at least 3600 seconds. Consider progressive banning.

---

### MEDIUM-05 -- SSH TCP and Agent Forwarding Enabled

- **Spec file**: `specs/02-system/03-security.md` (line 162)
- **Affected hosts**: All VPS hosts
- **Risk**: TCP forwarding allows tunnel creation. Agent forwarding exposes the SSH agent socket -- if the VPS is compromised during an active session, the attacker can use the forwarded agent to authenticate to other hosts.
- **Remediation**: Disable both in sshd_config: `AllowTcpForwarding no`, `AllowAgentForwarding no`.

---

### MEDIUM-06 -- Shared Memory Hardening Targets Wrong Path on Modern Ubuntu

- **Spec file**: `specs/02-system/03-security.md` (line 201)
- **Affected hosts**: All VPS hosts running Ubuntu 24.04
- **Risk**: On Ubuntu 24.04, shared memory is at `/dev/shm`, not `/run/shm`. Mounting tmpfs at `/run/shm` may not protect `/dev/shm`. Attackers commonly stage payloads in `/dev/shm`.
- **Remediation**: Target `/dev/shm` instead.

---

### MEDIUM-07 -- Auditd Rules Do Not Cover Docker or Tailscale Activity

- **Spec file**: `specs/02-system/03-security.md` (lines 189-198)
- **Affected hosts**: All VPS hosts
- **Risk**: Audit rules do not cover:
  1. Docker socket access (`/var/run/docker.sock`) -- root-equivalent
  2. Docker container creation (`/usr/bin/docker`)
  3. Tailscale configuration changes (`/var/lib/tailscale/`)
  4. OpenClaw env file containing API keys
  5. Crontab modifications
- **Remediation**: Add audit rules:
  - `-w /var/run/docker.sock -p rwxa -k docker_access`
  - `-w /usr/bin/docker -p x -k docker_command`
  - `-w /var/lib/tailscale/ -p wa -k tailscale_config`
  - `-w /etc/crontab -p wa -k cron_modification`
  - `-w /var/spool/cron/ -p wa -k cron_modification`
  - `-w /home/matthewkeilbot/.openclaw/env -p rwa -k openclaw_secrets`

---

### MEDIUM-08 -- Ansible Control Path in /tmp Is World-Readable

- **Spec file**: `specs/01-project-scaffolding.md` (line 32)
- **Affected hosts**: Ansible control machine
- **Risk**: Other users on the control machine can enumerate active Ansible SSH connections by listing files matching the predictable pattern in `/tmp`.
- **Remediation**: Use a user-private directory: `~/.ssh/ansible-%%h-%%p-%%r`

---

### LOW-01 -- No /proc hidepid Configuration

- **Spec file**: `specs/02-system/03-security.md`
- **Affected hosts**: All VPS hosts
- **Risk**: Without `hidepid=2`, all users can see all processes and command-line arguments.
- **Note**: The OpenClaw systemd unit already uses `ProtectProc=invisible` which is the modern systemd equivalent. For system-wide hardening, consider `hidepid=2` on `/proc`.

---

### LOW-02 -- Unattended Upgrades Auto-Reboot Disabled

- **Spec file**: `specs/02-system/03-security.md` (line 126)
- **Affected hosts**: All VPS hosts
- **Risk**: Kernel security updates require reboot. Host continues running vulnerable kernel until manual reboot.
- **Risk assessment**: For single-host, auto-reboots risk unplanned downtime. Current approach is reasonable if operator monitors for pending reboots.
- **Remediation**: Add monitoring for pending reboots in the alert script so user knows when reboot is necessary

---

### LOW-03 -- node_exporter Version 1.7.0 May Be Outdated

- **Spec file**: `specs/01-project-scaffolding.md` (line 119)
- **Risk**: Pinned version won't receive security patches. Requires manual version bump.
- **Remediation**: Periodically review releases and update.

---

### LOW-04 -- SFTP Subsystem Enabled in SSH

- **Spec file**: `specs/02-system/03-security.md` (line 165)
- **Risk**: Increases attack surface slightly. If restricted users are ever added, SFTP allows unintended file access.
- **Remediation**: Disable if not needed.

---

### LOW-05 -- Zig Old Versions Not Cleaned Up

- **Spec file**: `specs/04-toolchain/04-zig.md` (line 79)
- **Risk**: Old binaries with known vulnerabilities remain on disk. Attacker could invoke old version by path.
- **Remediation**: Remove old versions during upgrades.

---

### LOW-06 -- Nginx Catch-All HTTPS Listener Has No Certificate

- **Spec file**: `specs/03-services/02-nginx.md` (lines 93-94)
- **Risk**: HTTPS connections to unrecognized hostnames fail with SSL handshake error. Port scanners identify nginx without valid certificate.
- **Remediation**: Remove 443 listener if no HTTPS sites served.  Also remove 80 listener if no HTTP sites served.

---

### LOW-07 -- Alert Script Runs as Root via Cron

- **Spec file**: `specs/03-services/04-monitoring.md` (line 68)
- **Risk**: `/opt/monitoring/alert-check.sh` runs as root every 5 minutes. If modified by an attacker, provides root execution.
- **Risk assessment**: Low -- directory permissions (`0750`) are correct and only root can modify. Script uses `set -euo pipefail`.
- **Remediation**: Add to auditd monitoring: `-w /opt/monitoring/alert-check.sh -p wa -k monitoring_script`

---

## Positive Security Observations

1. **Service user isolation**: nologin shell, 0700 home directories, `append: false` group management, explicit docker group removal. Excellent.

2. **OpenClaw systemd hardening**: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=tmpfs`, `CapabilityBoundingSet=` (empty), `RestrictNamespaces`, `SystemCallFilter` whitelist, `ProtectProc=invisible`, `PrivateTmp`. One of the strongest systemd hardening profiles in Ansible projects.

3. **Sysctl kernel hardening**: Full ASLR, restricted kernel pointers, dmesg restriction, TCP syncookies, reverse path filtering, martian packet logging, ICMP hardening. Comprehensive and correct.

4. **Auditd immutability**: The `-e 2` rule makes audit configuration immutable until reboot, preventing attacker from disabling auditing.

5. **SSH hardening**: Key-only auth, custom port (vault-encrypted), no root login, AllowUsers + DenyUsers defense-in-depth, MaxAuthTries=3, LoginGraceTime=30, VERBOSE logging, sshd_config validation before deployment.

6. **Secret handling**: All secret tasks use `no_log: true`, env files are mode 0600, auth tokens generated with `openssl rand -hex 32`.

7. **node_exporter systemd hardening**: Runs as dedicated system user with NoNewPrivileges, ProtectSystem=strict, ProtectHome, PrivateTmp, kernel protection.

8. **OpenClaw binds to loopback only**: `127.0.0.1:<vault_openclaw_port>` with Tailscale Serve providing HTTPS. Correct pattern.

9. **Tailscale minimum version enforcement**: Checks against 1.54 minimum to prevent TS-2024-001 deployment.

10. **Zig checksum enforcement**: Role fails if checksum is empty. Gold standard for binary downloads.

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| CRITICAL | 2 | OpenClaw sandbox disabled; Docker group = root |
| HIGH | 4 | Tailscale SSH bypass; blanket tailscale0 UFW; MITM via host_key_checking; NOPASSWD:ALL sudo |
| MEDIUM | 8 | Rustup no checksum; n no checksum; MDWE disabled; short fail2ban; SSH forwarding; /run/shm path; auditd gaps; control path in /tmp |
| LOW | 7 | No hidepid; no auto-reboot + no monitoring; node_exporter version; SFTP enabled; old Zig versions; nginx catch-all cert; alert script root cron |

**Overall assessment**: The spec demonstrates a high level of security awareness. The systemd hardening, sysctl configuration, auditd setup, and user isolation model are all well-designed. The most impactful finding is CRITICAL-01 (sandbox mode off) because it exposes the host to arbitrary code execution from an AI agent processing untrusted input, partially mitigated by strong systemd sandboxing.

**Priority remediation order**:

1. Enable OpenClaw sandbox mode (CRITICAL-01)
2. Tighten Tailscale UFW rules (HIGH-02)
3. Fix Ansible host_key_checking (HIGH-03)
4. Evaluate Tailscale SSH necessity (HIGH-01)
5. Add missing auditd rules (MEDIUM-07)
6. Fix shared memory path for Ubuntu 24.04 (MEDIUM-06)
7. Enforce toolchain download checksums (MEDIUM-01, MEDIUM-02)
