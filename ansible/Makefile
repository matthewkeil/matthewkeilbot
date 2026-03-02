.DEFAULT_GOAL := help
SHELL := /bin/bash

VAULT_FILE := inventory/group_vars/all/vault.yml
PLAYBOOK_DIR := playbooks


deps: ## Install Ansible Galaxy dependencies
	ansible-galaxy collection install -r requirements.yml --force

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

##
##
##
##   Playbooks
##
##
##
bootstrap: ## First-time VPS bootstrap — creates devops user + SSH port (as root, port 22). Run 'make system' next!
	ansible-playbook $(PLAYBOOK_DIR)/bootstrap_ssh.yml \
		-e ansible_user=root \
		-e ansible_port=22

system: ## System layer (common + users + security) — run promptly after bootstrap to harden
	ansible-playbook $(PLAYBOOK_DIR)/setup_system.yml
services: ## Run services layer (docker + nginx + tailscale + monitoring)
	ansible-playbook $(PLAYBOOK_DIR)/setup_services.yml
toolchain: ## Run toolchain layer (node + python + rust + zig)
	ansible-playbook $(PLAYBOOK_DIR)/setup_toolchain.yml

deploy-openclaw: ## Deploy OpenClaw application
	ansible-playbook $(PLAYBOOK_DIR)/deploy_openclaw.yml
update-nginx: ## Update nginx sites (stub — no-op for now)
	ansible-playbook $(PLAYBOOK_DIR)/update_nginx.yml

##
##
##
##   Utility Commands
##
##
##
check: ## Syntax-check all playbooks and dry-run all.yml
	@echo "=== Syntax checking all playbooks ==="
	@for pb in $(PLAYBOOK_DIR)/*.yml; do \
		echo "Checking $$pb..."; \
		ansible-playbook --syntax-check "$$pb" || exit 1; \
	done
	@echo "=== Dry-run all.yml ==="
	ansible-playbook $(PLAYBOOK_DIR)/all.yml \
		--check --diff
lint: ## Run ansible-lint and yamllint
	ansible-lint
	yamllint .

ping: ## Test connectivity to hosts
	ansible vps -m ansible.builtin.ping

facts: ## Gather and display host facts
	ansible vps -m ansible.builtin.setup

##
##
##
##   Vault Commands
##
##
##
vault-edit: ## Edit the encrypted vault file
	ansible-vault edit $(VAULT_FILE)

vault-encrypt: ## Encrypt the vault file
	ansible-vault encrypt $(VAULT_FILE)

vault-decrypt: ## Decrypt the vault file (re-encrypt when done!)
	@echo "WARNING: Remember to re-encrypt with 'make vault-encrypt' when done."
	ansible-vault decrypt $(VAULT_FILE)

vault-view: ## View vault contents without decrypting on disk
	ansible-vault view $(VAULT_FILE)

##
##
##
##   Testing Commands
##
##
##
validate: ## Validate all prerequisite variables (no server needed)
	ansible-playbook $(PLAYBOOK_DIR)/validate_vars.yml
test-bootstrap: ## Run bootstrap verification tests (post-bootstrap, pre-system)
	ansible-playbook $(PLAYBOOK_DIR)/test_bootstrap.yml
test-system: ## Run system layer verification tests
	ansible-playbook $(PLAYBOOK_DIR)/test_system.yml
test-app: ## Run services/toolchain/application verification tests
	ansible-playbook $(PLAYBOOK_DIR)/test_services_and_app.yml
test: test-system test-app ## Run all verification tests

.PHONY: help bootstrap system services toolchain deploy-openclaw upgrade-openclaw update-nginx \
        check lint vault-edit vault-encrypt vault-decrypt vault-view inventory ping facts deps \
        validate test-bootstrap test-system test-app test