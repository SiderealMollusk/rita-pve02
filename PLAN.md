# Proxmox Lab CLI Implementation Plan

## Overview

Build a TypeScript-based developer CLI (`lab`) for managing a Proxmox homelab environment from inside a devcontainer. The tool orchestrates Terraform → Ansible → Kubernetes deployment phases with live task UI, structured output, and composable check/action chains.

## Stack

- **Node 20+**
- **TypeScript**
- **oclif** (CLI framework)
- **Listr2** (task/check runner with live UI)
- **execa** (safe shell execution)
- **dotenv** (environment loading)

## Configuration Strategy

Split configuration to minimize secrets on disk:

1. **`.env`** (committed): Public configuration only
   - Vault name, IPs, endpoints, names, storage pools
   - Example: `OP_VAULT=proxmox-cluster`, `PVE02_TS_MAGIC_IP=100.121.136.16`

2. **`secrets.template`** (committed): 1Password references as template
   - Contains `op://vault/item/field` references
   - Example: `TF_VAR_PROXMOX_API_TOKEN=op://pve02/proxmox/api-token`

3. **`secrets.env`** (ephemeral, .gitignore): Generated at CLI startup
   - Created via `op inject -i secrets.template -o secrets.env`
   - Loaded at startup, deleted at exit
   - Warnings if it exists before startup (stale secrets)
   - Best-effort cleanup on error (no signal trapping complexity)

## Commands

All commands support `--dry-run`, `--json`, `--only-tags`, `--from`, `--to` where applicable.

- **`lab preflight`**: Run smoke + preflight checks
  - Devcontainer tooling (terraform, ansible, kubectl, op, tailscale versions)
  - 1Password vault + secret refs validation
  - Tailscale connectivity + expected nodes/IPs
  - Proxmox API reachability, qm CLI, disk space (50GB+)
  - SSH keys availability

- **`lab terraform`**: Validate → Plan → Apply chain
  - `terraform fmt -check`, `terraform init`, `terraform validate`
  - `terraform plan -out tfplan`
  - `terraform apply tfplan` (with confirmation)
  - Extract outputs for downstream phases

- **`lab ansible`**: Run Ansible playbooks
  - Validate inventory file exists
  - Run baseline.yml (hardening + tailscale)
  - Run k3s-setup.yml (k3s control plane + agents)

- **`lab k8s`**: Placeholder for future workload deployment
  - kubectl/helm commands for deploying apps to cluster

- **`lab up`**: Orchestrate full chain
  - Manage `secrets.env` lifecycle around all phases
  - Execute: preflight → terraform apply → ansible → k8s
  - Stop on first failure

## Architecture

### Project Structure

```
cli/
  src/
    commands/
      preflight.ts      # Check runner, configurable chains
      terraform.ts      # Terraform orchestration
      ansible.ts        # Ansible playbook runner
      k8s.ts            # Kubernetes workload (future)
      up.ts             # Full orchestration
    lib/
      types.ts          # Check, CheckResult, Chain, RunContext, Config types
      config.ts         # Load & validate .env + secrets.env
      exec.ts           # Safe shell execution wrapper (execa)
      summary.ts        # Format final summary table
      chains.ts         # Compose checks into chains, support filtering
      secrets.ts        # Manage secrets.env lifecycle (generate, cleanup)
      checks.ts         # Reusable check objects (factory)
    checks/
      op-cli.ts         # op version, whoami, vault, secret refs
      tailscale.ts      # tailscale version, status, nodes/IPs
      proxmox-cli.ts    # qm version, disk space, API reachability
      terraform.ts      # fmt, init, validate
      ssh-keys.ts       # SSH private key existence
  .oclif.json           # oclif config
  package.json
  tsconfig.json
  README.md
.env                    # Public config (refactored)
secrets.template        # op:// references (refactored)
.gitignore              # Exclude secrets.env
```

### Core Concepts

**Check Object**:
```typescript
type Check<Ctx> = {
  id: string
  title: string
  tags?: string[]
  run(ctx: Ctx): Promise<CheckResult>
}

type CheckResult = {
  status: "pass" | "fail" | "warn" | "skip"
  message?: string
  details?: string
  data?: unknown
}
```

**Chain**:
- Compose multiple checks with filtering (`--only-tags`, `--from`, `--to`)
- Run in order, report on each, accumulate summary
- Support `--dry-run` (validate without applying) and `--json` (machine-readable output)

**Secrets Lifecycle**:
1. CLI startup: Check if `secrets.env` exists (warn if stale)
2. Delete any existing `secrets.env`
3. Generate fresh via `op inject -i secrets.template -o secrets.env`
4. Load into process.env
5. Run commands
6. Delete `secrets.env` at exit (best-effort)

### Composability

Design commands to support both workflows:

**Workflow A (Manual)**:
```bash
# User manually sets up .env and secrets.template
lab preflight --json > report.json
# Review, then apply
lab terraform --dry-run
lab terraform --apply
lab ansible --dry-run
lab ansible --apply
```

**Workflow B (Automated)**:
```bash
lab up  # Runs all phases, stops on failure
```

## Checks to Implement

### Devcontainer / Tooling (smoke)
- ✅ terraform version
- ✅ ansible --version
- ✅ kubectl version --client
- ✅ op --version
- ✅ tailscale version

### 1Password (preflight)
- ✅ op whoami (authenticated)
- ✅ op vault get $OP_VAULT (vault exists)
- ✅ op read <ref> for each secret (refs resolve + non-empty)

### Tailscale (preflight)
- ✅ tailscale status --json (up + authenticated)
- ✅ Expected nodes exist with correct IPs (configurable targets)

### Proxmox (preflight)
- ✅ qm version (CLI available)
- ✅ curl to API endpoint (reachable)
- ✅ Disk space >= 50GB on storage pool

### Terraform (plan)
- ✅ terraform fmt -check
- ✅ terraform init
- ✅ terraform validate

### Ansible (preflight)
- ✅ Inventory file exists
- ✅ Connectivity to all hosts (optional SSH test)

### SSH (preflight)
- ✅ Private key exists at ~/.ssh/id_rsa

## Output Modes

**TUI (human)**:
- Real-time task progress via Listr2
- Nested phases with indent
- Final summary table:
  - Total checks run
  - Passed / Failed / Warn / Skipped counts
  - Duration per check
  - Failure reasons + details

**JSON (CI)**:
- Machine-readable check results
- Structured error messages
- Exit code != 0 on failure

## Success Criteria

- ✅ `lab preflight` runs, shows live task UI + final summary
- ✅ `lab up` orchestrates all phases in order, stops on failure
- ✅ Works in devcontainer and CI (no assumptions about local tools beyond Node)
- ✅ Easy to add new checks as typed objects
- ✅ Secrets never live on disk longer than CLI runtime
- ✅ `--dry-run`, `--json`, `--only-tags`, `--from`, `--to` all functional
- ✅ Clear error messages and non-zero exit codes on failure

## Notes

- No Turbo; oclif command composition is sufficient
- No signal trapping; best-effort secrets cleanup
- Shell-first business logic (terraform, ansible, curl, op); TypeScript is orchestration
- All commands safe (no eval, no hardcoded paths)
- Fully typed, modular, testable
