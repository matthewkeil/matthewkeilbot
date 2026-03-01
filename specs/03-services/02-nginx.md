# Role Spec: `nginx`

## Purpose

Install Nginx and set up a multi-vhost skeleton structure ready for future sites. No application-specific vhosts are configured by this role — just the base infrastructure with a secure default catch-all and an example template showing how to add sites.

## Role Structure

```
roles/nginx/
├── tasks/
│   └── main.yml
├── defaults/
│   └── main.yml
├── handlers/
│   └── main.yml
├── templates/
│   ├── nginx.conf.j2
│   ├── default-catchall.conf.j2
│   └── example-site.conf.j2.example
└── files/
    └── .gitkeep
```

## Defaults

| Variable | Default | Notes |
|---|---|---|
| `nginx_worker_processes` | `auto` | |
| `nginx_worker_connections` | `1024` | |
| `nginx_keepalive_timeout` | `65` | seconds |
| `nginx_client_max_body_size` | `10m` | |
| `nginx_remove_default_site` | `true` | Removes Ubuntu default site |
| `nginx_security_headers` | see below | Applied to all sites in http block |

Default security headers:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Tasks

### 1. Install Nginx
- Install `nginx` package from apt
- Notify handler to start nginx on first install

### 2. Deploy base nginx.conf
- Template `nginx.conf.j2` to `/etc/nginx/nginx.conf` (owner root, mode 0644)
- Validate config with `nginx -t` before applying
- Keep backup of previous config
- Notify handler to reload nginx on change

### 3. Set up sites-available / sites-enabled pattern
- Ensure `/etc/nginx/sites-available` exists (owner root, mode 0755)
- Ensure `/etc/nginx/sites-enabled` exists (owner root, mode 0755)
- When `nginx_remove_default_site` is true, remove both `/etc/nginx/sites-enabled/default` and `/etc/nginx/sites-available/default`

### 4. Deploy catch-all default server
- Template `default-catchall.conf.j2` to `/etc/nginx/sites-available/00-default-catchall.conf`
- Symlink into `/etc/nginx/sites-enabled/00-default-catchall.conf`
- Notify handler to reload nginx on change

### 5. Deploy example site template
- Template `example-site.conf.j2.example` to `/etc/nginx/sites-available/README-example-site.conf`
- This file is documentation only — it has no symlink and is never loaded by nginx

### 6. Validate and start
- Run `nginx -t` to validate final configuration (not a change, just a check)
- Ensure nginx is enabled and started via systemd

## Templates

### `nginx.conf.j2`

Main nginx configuration. Key settings:
- User: `www-data`
- `worker_processes` and `worker_connections` from defaults
- `server_tokens off` to hide nginx version
- `keepalive_timeout` and `client_max_body_size` from defaults
- sendfile, tcp_nopush, tcp_nodelay enabled
- MIME types included, default type `application/octet-stream`
- Access log: `/var/log/nginx/access.log`; error log: `/var/log/nginx/error.log`
- Gzip enabled with `gzip_vary`, `gzip_proxied any`, compression level 6, common content types
- Security headers from `nginx_security_headers` applied globally via `add_header ... always`
- Includes `/etc/nginx/sites-enabled/*.conf` for virtual hosts

### `default-catchall.conf.j2`

Catch-all server block that silently drops unrecognized connections. Key settings:
- Listens on port 80 and 443 as `default_server` for both IPv4 and IPv6
- `server_name _` (matches anything not matched by another block)
- Returns `444` (close connection without response) for all requests
- Includes commented-out SSL certificate directives for a self-signed default cert (manual step, not automated)

### `example-site.conf.j2.example`

Reference documentation deployed to `/etc/nginx/sites-available/README-example-site.conf`. Describes:
- How to copy and edit the file to create a new vhost
- How to enable a site via symlink
- How to test and reload nginx
- An example proxy_pass block with `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers
- Optional WebSocket upgrade headers (commented out)
- For Ansible-managed sites: add a role or playbook that templates the vhost and creates the symlink

## Handlers

- **Start nginx**: starts the nginx systemd service and ensures it is enabled (used on first install)
- **Reload nginx**: reloads nginx configuration without dropping connections (used on config changes)

## Design Decisions

- **Catch-all returns 444**: Silently drops connections to unrecognized hostnames, preventing hostname enumeration and reducing attack surface.
- **HTTPS in catch-all commented out**: Requires generating a self-signed cert first. Left as a manual step since it is not critical for a host that does not serve public HTTPS yet.
- **`server_tokens off`**: Hides nginx version from response headers.
- **Security headers in http block**: Applied globally to all sites. Individual sites can override.
- **Example file is not `.conf`**: Named `README-example-site.conf` (no symlink), so nginx never loads it.
- **`validate: "nginx -t"`**: Configuration is validated before deployment, preventing bad configs from being applied.

## Dependencies

- `common` role

## Idempotency Notes

- Package installation is idempotent
- Template deployment only changes if content differs
- Symlink creation is idempotent
- Configuration validation prevents broken deployments
