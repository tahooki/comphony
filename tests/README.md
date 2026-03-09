# Setup Test Flow

Use these files to test the full Comphony setup lifecycle.

## 1. Fresh clone check

Run:

```bash
./tests/preflight.sh
```

This verifies that the repo contains the expected templates, scripts, ignored local paths, and documentation.

## 2. Initialize local state

Run:

```bash
./scripts/init-local-setup.sh
```

This creates:

- `.env` from `.env.example` if missing
- `MISSION.md` from `MISSION.template.md` if missing
- `agents/` and `runtime-data/` if missing
- local `repos/`, `workspaces/`, and `workflows/` directories

## 3. Validate the tracked runtime config

Run:

```bash
npm install
npm run validate:config
```

If you want the local HTTP runtime:

```bash
npm run server:start
```

## 4. Check the task runtime flow

Example:

```bash
npm run comphony -- project list
npm run comphony -- agent list --project product_core
npm run comphony -- task create --project product_core --lane design --title "Draft a design plan"
npm run comphony -- task list --project product_core
```

Conversation-to-task example:

```bash
npm run comphony -- thread create --title "Dashboard refresh request"
npm run comphony -- message send --thread thread_0001 --body "Please design a cleaner dashboard UI for Product - Core."
npm run comphony -- message promote --message msg_0001
npm run comphony -- task list --project product_core
```

One-shot intake example:

```bash
npm run comphony -- intake create \
  --title "Refresh Product - Core dashboard" \
  --body "Please redesign the Product - Core dashboard UI and improve the UX."
npm run comphony -- event list --limit 10
```

## 5. Fill local environment values

Edit `.env` and set at least:

- `LINEAR_API_KEY`
- `SYMPHONY_BIN`
- `COMPHONY_ROOT`
- `COMPHONY_REPO_ROOT`
- `COMPHONY_WORKSPACE_ROOT`
- `COMPHONY_WORKFLOW_ROOT`

## 6. Ask Codex to do the setup

Example prompt:

```text
Read this repo and set it up for me.
Create any missing local setup files yourself, including MISSION.md.
Keep going until the current Comphony runtime foundation is working end-to-end.
```

## 7. Validate the result

Run:

```bash
./tests/validate-setup.sh
```

If you also want network checks:

```bash
./tests/validate-setup.sh --live
```

`--live` adds:

- Symphony dashboard reachability check
- Linear API key validation through GraphQL

## 8. Reset and test again

To clear local generated state and repeat the setup flow:

```bash
./scripts/reset-local-state.sh --confirm
```

Optional destructive flags:

```bash
./scripts/reset-local-state.sh --confirm --with-repos
./scripts/reset-local-state.sh --confirm --with-env
```

Use `--with-repos` only if you want to remove locally cloned source repos as well.
