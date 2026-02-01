# Proxmox Lab CLI

A TypeScript-based developer CLI for managing a Proxmox homelab environment from inside a devcontainer. The tool supports preflight checks, deployment phases (Terraform → Ansible → Kubernetes), and provides live task output with structured summaries.

## Features

- **Composable check chains** with filtering (`--only-tags`, `--from`, `--to`)
- **Live task UI** powered by Listr2 + final summary reports
- **JSON output mode** for CI/automation
- **Ephemeral secrets management** via 1Password (`op inject`)
- **Shell-first business logic**: Uses execa for safe execution of terraform, ansible, op, curl, etc.
- **Fully typed** TypeScript for IDE support and safety

## Installation

Node.js 20+ required.

```bash
npm install
npm run build
```

Or run in dev mode directly:

```bash
npm run dev -- preflight
```

## Quick Start

### 1. Configure Secrets

Set up 1Password vault with required items. The CLI expects:

```bash
op://pve02/proxmox/api-token        # Proxmox API token
op://pve02/ssh/public-key           # SSH public key for VMs
op://pve02/ssh/private-key          # SSH private key for Ansible
op://pve02/tailscale/auth-key       # Tailscale auth key
op://pve02/k8s-vms/ssh-password     # (Optional) VM SSH password
```

Update `secrets.template` if your vault structure differs.

### 2. Run Preflight Checks

```bash
npm run preflight
# or
npm run dev -- preflight
```

Output shows real-time task progress + final summary:

```
▶ Running preflight checks...

╔════════════════════════════════════════════════════╗
║ Smoke Checks                                       ║
╚════════════════════════════════════════════════════╝

  Total: 3 checks
  Results: 3 passed | 0 failed | 0 warned | 0 skipped
  Duration: 0.45s

  Checks:
    ✓ PASS (0.12s): 1Password CLI version - op version 2.25.0
    ✓ PASS (0.15s): Terraform version - Terraform v1.6.0
    ✓ PASS (0.18s): Tailscale version - version 1.46.0, ...

  ✓ All checks passed!
```

### 3. Filter Checks

Run only specific checks:

```bash
# Only smoke checks
npm run dev -- preflight --only-tags smoke

# Only 1Password checks
npm run dev -- preflight --only-tags op

# Run from op-vault to proxmox-api
npm run dev -- preflight --from op-vault --to proxmox-api

# Dry-run (default for preflight)
npm run dev -- preflight --dry-run false
```

### 4. JSON Output

For CI automation:

```bash
npm run dev -- preflight --json > report.json
```

Output:

```json
{
  "chains": [
    {
      "name": "Smoke Checks",
      "total": 3,
      "passed": 3,
      "failed": 0,
      "warned": 0,
      "skipped": 0,
      "duration": 0.45,
      "checks": [
        {
          "id": "op-version",
          "title": "1Password CLI version",
          "tags": ["smoke", "op"],
          "result": {
            "status": "pass",
            "message": "op version 2.25.0",
            "duration": 0.12
          }
        }
      ],
      "summary": "all checks passed"
    }
  ],
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0
  }
}
```

## Commands

### `lab preflight` (or `npm run preflight`)

Run comprehensive preflight checks:

- **Smoke checks**: CLI tools installed (op, terraform, tailscale, kubectl, ansible)
- **1Password**: Vault exists, secrets resolve
- **Tailscale**: Up, expected nodes reachable
- **Proxmox**: API reachable, qm CLI available, disk space
- **SSH**: Private key exists
- **Ansible**: Inventory file exists

Flags:
- `--only-tags <tags>` - Filter by tags (smoke, op, tailscale, proxmox, terraform, ansible, ssh)
- `--from <id>` - Start from check ID
- `--to <id>` - Stop at check ID
- `--json` - JSON output
- `--dry-run` - Validation without applying (default for preflight)
- `--verbose` - Verbose output

### `lab terraform`

Validate and apply Terraform (todo):

```bash
npm run dev -- terraform --dry-run
npm run dev -- terraform --apply
```

### `lab ansible`

Run Ansible playbooks (todo):

```bash
npm run dev -- ansible --dry-run
npm run dev -- ansible --apply
```

### `lab k8s`

Deploy workloads to cluster (todo):

```bash
npm run dev -- k8s --apply
```

### `lab up`

Run full deployment chain: preflight → terraform → ansible → k8s (todo):

```bash
npm run dev -- up
```

## Configuration

### `.env` (committed, public config only)

```bash
OP_VAULT="pve02"
PVE02_TS_MAGIC_IP=100.121.136.16
TF_VAR_proxmox_endpoint="https://100.121.136.16:8006/"
TF_VAR_node_name="pve"
TF_VAR_storage_pool="local-lvm"
TF_VAR_network_bridge="vmbr0"
```

### `secrets.template` (committed, op:// references)

```bash
TF_VAR_PROXMOX_API_TOKEN="op://pve02/proxmox/api-token"
TF_VAR_SSH_PUBLIC_KEY="op://pve02/ssh/public-key"
SSH_PRIVATE_KEY="op://pve02/ssh/private-key"
TAILSCALE_AUTH_KEY="op://pve02/tailscale/auth-key"
VM_SSH_PASSWORD="op://pve02/k8s-vms/ssh-password"
```

### `secrets.env` (ephemeral, git-ignored)

**NEVER commit this file.** Generated at CLI startup via `op inject -i secrets.template -o secrets.env`, loaded into process.env, deleted at exit (best-effort).

Workflow:
1. CLI startup: Warn if `secrets.env` exists (stale)
2. Delete any stale `secrets.env`
3. Generate fresh via `op inject`
4. Load into process.env
5. CLI runs
6. Delete `secrets.env` on exit

## Secret Management

### 1Password Authentication

Ensure you're signed in:

```bash
eval $(op signin)
```

### Adding Secrets to 1Password

Run the setup script (or use 1Password UI):

```bash
./scripts/setup-1password.sh
```

This creates:
- **pve02/proxmox** vault item with `api-token` field
- **pve02/ssh** vault item with `public-key` and `private-key` fields
- **pve02/tailscale** vault item with `auth-key` field
- **pve02/k8s-vms** vault item with `ssh-password` field

### Rotating Secrets

(To be implemented: `lab rotate` command)

For now, manually update 1Password items, and the CLI will read the updated values at next run.

## Architecture

### Project Structure

```
src/
  bin/
    run.ts              # CLI entry point
  commands/
    preflight.ts        # Preflight checks command
    terraform.ts        # Terraform orchestration (todo)
    ansible.ts          # Ansible playbooks (todo)
    k8s.ts              # Kubernetes workloads (todo)
    up.ts               # Full chain (todo)
  lib/
    types.ts            # Core types (Check, CheckResult, Chain, etc)
    config.ts           # Config loading & validation
    exec.ts             # Safe shell execution wrapper
    summary.ts          # Report formatting
    chains.ts           # Chain composition & filtering
    secrets.ts          # Secrets.env lifecycle
  checks/
    op-cli.ts           # 1Password checks
    tailscale.ts        # Tailscale checks
    proxmox-cli.ts      # Proxmox API/CLI checks
    terraform.ts        # Terraform checks
    ssh-keys.ts         # SSH/Ansible checks
```

### Check Objects

Each check is a typed object with `id`, `title`, `tags`, and `run()` method:

```typescript
const myCheck: Check = {
  id: "my-check",
  title: "My custom check",
  tags: ["custom", "smoke"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const result = await exec("some-command", ["--flag"]);
      return {
        status: "pass",
        message: result.stdout,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Command failed",
        details: error.message,
      };
    }
  },
};
```

### Adding New Checks

1. Create a new check object in `src/checks/`
2. Export it
3. Import and add to a command's chain:

```typescript
import { myCheck } from "../checks/my-module";

const checks: Check[] = [
  opVersionCheck,
  myCheck,  // Add here
  tailscaleVersionCheck,
];
```

## Development

### Build

```bash
npm run build
```

Outputs to `dist/`.

### Development Mode

Run TypeScript directly without building:

```bash
npm run dev -- preflight
```

### Project Scripts

- `npm run build` - TypeScript compilation
- `npm run dev` - Run CLI via tsx (no build)
- `npm run preflight` - Shortcut for `npm run dev -- preflight`

## Error Handling

### Common Issues

**`Missing required environment variables: OP_VAULT`**
- Ensure `.env` is present and has `OP_VAULT=pve02`

**`Not authenticated with 1Password`**
- Run: `eval $(op signin)`

**`Vault not found: pve02`**
- Vault name in `OP_VAULT` doesn't match 1Password vault
- Check: `op vault list`

**`Secret references fail to resolve`**
- Ensure all items in `secrets.template` exist in 1Password
- Check: `op item list --vault pve02`
- Verify field names match (`api-token`, not `token`)

**`Secrets.env not found. Did you call generate()?`**
- CLI lifecycle issue; should not happen in normal usage
- Ensure `op inject` succeeds in your 1Password setup

## Testing

(To be implemented)

Run with `npm test`.

## Future Phases

- [ ] `lab terraform` - Plan, apply, output extraction
- [ ] `lab ansible` - Inventory generation, playbook execution
- [ ] `lab k8s` - kubectl/helm workload deployment
- [ ] `lab up` - Full orchestration with failure handling
- [ ] `lab rotate` - Secret rotation workflow
- [ ] `lab init` - Initialize `.env` from template
- [ ] Unit/integration tests with vitest

## License

ISC

## Support

For issues or feature requests, see [PLAN.md](PLAN.md) for architecture details.
