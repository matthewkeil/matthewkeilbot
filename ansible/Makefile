.DEFAULT_GOAL := help
SHELL := /bin/bash

VAULT_FILE := inventory/group_vars/all/vault.yml
PLAYBOOK_DIR := playbooks

.PHONY: deps
deps: ## Install Ansible Galaxy dependencies
	ansible-galaxy collection install -r requirements.yml --force

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

##
##
##
##   Playbooks
##
##
##
.PHONY: bootstrap
bootstrap: ## First-time VPS bootstrap — creates devops user + SSH port (as root, port 22). Run 'make system' next!
	ansible-playbook $(PLAYBOOK_DIR)/bootstrap_ssh.yml \
		-e ansible_user=root \
		-e ansible_port=22

.PHONY: system
system: ## System layer (common + users + security) — run promptly after bootstrap to harden
	ansible-playbook $(PLAYBOOK_DIR)/setup_system.yml

.PHONY: services
services: ## Run services layer (docker + nginx + tailscale + monitoring)
	ansible-playbook $(PLAYBOOK_DIR)/setup_services.yml

.PHONY: toolchain
toolchain: ## Run toolchain layer (node + python + rust + zig)
	ansible-playbook $(PLAYBOOK_DIR)/setup_toolchain.yml

.PHONY: deploy-openclaw
deploy-openclaw: ## Deploy OpenClaw application
	ansible-playbook $(PLAYBOOK_DIR)/deploy_openclaw.yml

.PHONY: update-nginx
update-nginx: ## Update nginx sites (stub — no-op for now)
	ansible-playbook $(PLAYBOOK_DIR)/update_nginx.yml

##
##
##
##   Utility Commands
##
##
##
.PHONY: check
check: ## Syntax-check all playbooks and dry-run all.yml
	@echo "=== Syntax checking all playbooks ==="
	@for pb in $(PLAYBOOK_DIR)/*.yml; do \
		echo "Checking $$pb..."; \
		ansible-playbook --syntax-check "$$pb" || exit 1; \
	done
	@echo "=== Dry-run all.yml ==="
	ansible-playbook $(PLAYBOOK_DIR)/all.yml \
		--check --diff

.PHONY: validate
validate: ## Validate all prerequisite variables (no server needed)
	ansible-playbook $(PLAYBOOK_DIR)/validate_vars.yml

.PHONY: lint
lint: ## Run ansible-lint and yamllint
	ansible-lint
	yamllint .

.PHONY: ping
ping: ## Test connectivity to hosts
	ansible vps -m ansible.builtin.ping

.PHONY: facts
facts: ## Gather and display host facts
	ansible vps -m ansible.builtin.setup

##
##
##
##   Vault Commands
##
##
##
.PHONY: vault-edit
vault-edit: ## Edit the encrypted vault file
	ansible-vault edit $(VAULT_FILE)

.PHONY: vault-encrypt
vault-encrypt: ## Encrypt the vault file
	ansible-vault encrypt $(VAULT_FILE)

.PHONY: vault-decrypt
vault-decrypt: ## Decrypt the vault file (re-encrypt when done!)
	@echo "WARNING: Remember to re-encrypt with 'make vault-encrypt' when done."
	ansible-vault decrypt $(VAULT_FILE)

.PHONY: vault-view
vault-view: ## View vault contents without decrypting on disk
	ansible-vault view $(VAULT_FILE)

##
##
##
##   Testing Commands
##
##
##
.PHONY: test-bootstrap
test-bootstrap: ## Run bootstrap verification tests (post-bootstrap, pre-system)
	ansible-playbook $(PLAYBOOK_DIR)/test_bootstrap.yml

.PHONY: test-system
test-system: ## Run system layer verification tests
	ansible-playbook $(PLAYBOOK_DIR)/test_system.yml

.PHONY: test-app
test-app: ## Run services/toolchain/application verification tests
	ansible-playbook $(PLAYBOOK_DIR)/test_services_and_app.yml

.PHONY: test
test: test-system test-app ## Run all verification tests
