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
- local `repos/`, `workspaces/`, and `workflows/` directories

## 3. Fill local environment values

Edit `.env` and set at least:

- `LINEAR_API_KEY`
- `SYMPHONY_BIN`
- `COMPHONY_ROOT`
- `COMPHONY_REPO_ROOT`
- `COMPHONY_WORKSPACE_ROOT`
- `COMPHONY_WORKFLOW_ROOT`

## 4. Ask Codex to do the setup

Example prompt:

```text
Read this repo and set it up for me.
Create any missing local setup files yourself, including MISSION.md.
Keep going until Linear + Symphony is working end-to-end.
```

## 5. Validate the result

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

## 6. Reset and test again

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
