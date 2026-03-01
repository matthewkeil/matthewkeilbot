# Role Spec: `python`

## Purpose

Install Python system-wide using pyenv. Installs pyenv to `/opt/pyenv`, then installs the specified Python 3 version. Symlinks are created in `/usr/local/bin` so all users have access.

## Role Structure

```
roles/python/
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
| `python_pyenv_root` | `/opt/pyenv` | Installation directory for pyenv |
| `python_pyenv_version` | `v2.4.22` (overridable via `pyenv_version`) | pyenv release tag to install |
| `python_version` | `3.12.8` (overridable via `python3_version`) | Python version to install and set as global |
| `python_symlink_dir` | `/usr/local/bin` | Directory where `python`, `python3`, `pip`, `pip3` symlinks are created |
| `python_pyenv_commit_sha` | `""` | Expected git commit hash for the pyenv version tag; verified after clone for integrity |

### Build Dependencies

The following apt packages are required to compile Python from source:

- `build-essential`
- `libssl-dev`
- `zlib1g-dev`
- `libbz2-dev`
- `libreadline-dev`
- `libsqlite3-dev`
- `libncursesw5-dev`
- `xz-utils`
- `tk-dev`
- `libxml2-dev`
- `libxmlsec1-dev`
- `libffi-dev`
- `liblzma-dev`

## Tasks

### 1. Install build dependencies

- Install all packages listed in `python_build_deps` via apt

### 2. Install pyenv

- Check whether `{{ python_pyenv_root }}/bin/pyenv` exists
- If not present: clone the pyenv repository at `python_pyenv_version` with depth 1 to `python_pyenv_root`
- If already present: update the existing clone to `python_pyenv_version` (force checkout)
- Verify the checked-out commit hash matches `python_pyenv_commit_sha` (if set). Fail with descriptive message on mismatch.
- Set `python_pyenv_root` directory ownership to root recursively

### 3. Install Python version

- Query installed pyenv versions; skip compilation if `python_version` is already present
- Compile and install `python_version` via pyenv with a 1800-second async timeout (30 minutes) (poll every 30 seconds) to accommodate long compilation times
- Register the result and verify compilation succeeded. If the async job fails or times out, fail with descriptive message: 'Python {version} compilation failed or timed out. Check build dependencies and consider a larger instance.'
- Set the pyenv global version to `python_version` — use `changed_when: false` (idempotent state assertion)

### 4. Create symlinks

Create symlinks in `python_symlink_dir` (with `force: true` to handle target changes):

| Symlink | Target |
|---|---|
| `python3` | pyenv `python3` binary for `python_version` |
| `python` | pyenv `python3` binary for `python_version` |
| `pip3` | pyenv `pip3` binary for `python_version` |
| `pip` | pyenv `pip3` binary for `python_version` |

### 5. Profile script

- Deploy `/etc/profile.d/pyenv.sh` owned by root, mode `0644`, exporting `PYENV_ROOT`, prepending `${PYENV_ROOT}/bin` to `PATH`, and running `eval "$(pyenv init -)"`
- Verify the installation by calling the symlinked `python3 --version` — use `changed_when: false`
- Display the verified version and pyenv root path

## Design Decisions

- **pyenv over apt**: Ubuntu's system Python may not match the desired version. pyenv allows precise version pinning.
- **System-wide install to /opt**: All users share one Python installation via `/usr/local/bin` symlinks.
- **Build from source**: pyenv compiles Python from source, ensuring we get exactly the version specified. This takes several minutes but only happens once per version.
- **`async: 1800`**: Python compilation can take 10-30 minutes on small instances. The async timeout prevents Ansible from timing out.
- **Profile script**: Sets up pyenv for interactive shells so `pyenv` commands work for the devops user.

## Dependencies

- `common` role (for git, build-essential)

## Idempotency Notes

- pyenv install checks existing versions before compiling
- Symlinks use `force: true` to update if the target changes
- Git clone/update is idempotent
