---
name: run-erp
description: Build, run, and drive the Texas Precision Plating ERP (FastAPI + Postgres backend, React/Vite frontend). Use when asked to start the ERP, run its backend/frontend servers, seed its database, or take a screenshot of/interact with the running app.
---

FastAPI + Postgres backend and a React 19 + Vite frontend implementing a
NADCAP/AS9100D shop-floor ERP. Drive it by starting both dev servers, then
piping commands to `.claude/skills/run-erp/driver.mjs` — a small Playwright
REPL that stands in for `chromium-cli` (not installed in this container).

All paths below are relative to the repo root (`~/ERP/repo`).

## Prerequisites

Verified on Debian 12 (this container, "penguin"/ChromeOS Crostini). All of
these were already present here; installed nothing extra:

```bash
sudo apt-get install -y python3 python3-venv python3-pip postgresql postgresql-contrib curl git
# Node 20+ (nodesource) — Vite 8 / React 19 need it
node -v   # v20.20.2 verified
```

## Setup

One-shot script, safe to re-run (each step is idempotent):

```bash
bash setup-ubuntu.sh
```

This installs system packages, starts Postgres, creates the `surftec`
role/`surftec_erp` database, builds the backend venv + runs
`alembic upgrade head` + `seed.py` (fictional demo data), and runs
`npm install` for the frontend. Ran clean, no patches needed.

Real customer data (`backend/import_real_data.py` reading
`backend/data/tpp_export.sqlite`) is an alternative to `seed.py` but the
sqlite export isn't part of this repo — use the `seed.py` path documented
here unless you've placed that file yourself.

## Build

No separate build step for dev. (`frontend`'s `npm run build` only matters
for a production bundle, not for driving the app locally.)

## Run (agent path)

Start both servers in the background, then drive with Playwright.

```bash
# Backend — port 8000
cd ~/ERP/repo/backend && source .venv/bin/activate
nohup uvicorn app.main:app --port 8000 > /tmp/backend.log 2>&1 &
disown
timeout 20 bash -c 'until curl -sf http://localhost:8000/docs >/dev/null; do sleep 1; done'

# Frontend — port 5173
cd ~/ERP/repo/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
disown
timeout 20 bash -c 'until curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done'
```

Stop with `pkill -f 'uvicorn app.main:app'` and `pkill -f vite` before
relaunching, or the next run hits `EADDRINUSE`.

The driver (`.claude/skills/run-erp/driver.mjs`) needs Playwright's
Chromium, installed once into the skill directory:

```bash
cd ~/ERP/repo/.claude/skills/run-erp
npm install   # playwright is already in this dir's package.json
npx playwright install --with-deps chromium   # ~300MB, one-time
```

Then pipe commands to it (run from inside the skill dir so
`./screenshots/` lands there):

```bash
cd ~/ERP/repo/.claude/skills/run-erp
node driver.mjs <<'EOF'
nav http://localhost:5173
wait-for text=TPP ERP
fill input[type=email] m.torres@surftec.com
fill input[type=password] surftec-demo
click button:has-text("Sign in")
wait-for text=Dashboard
sleep 2000
screenshot dashboard
click text=Travelers
sleep 1500
screenshot travelers
console-errors
EOF
```

Screenshots land in `.claude/skills/run-erp/screenshots/<name>.png`.
`console-errors` prints any browser console errors captured since launch
(empty array `[]` = clean).

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<substring>` or `wait-for <css-selector>` | wait up to 15s |
| `click text=<substring>` \| `click <selector>` \| `click tag:has-text("...")` | click |
| `fill <selector> <value>` | fill an input (goes through real input events — required for React controlled inputs) |
| `press <key>` | keyboard press, e.g. `press Enter` |
| `sleep <ms>` | fixed wait |
| `screenshot [name]` | full-page PNG to `./screenshots/` |
| `console-errors` | dump captured console.error/pageerror text |
| `eval <js>` | `page.evaluate` |

Demo logins (from `seed.py`): ERP `m.torres@surftec.com` / `surftec-demo`
(Quality Manager); shop-floor PINs Torres `1001`, J. Kim `2002`,
D. Ochoa `3003`, R. Patel `4004`, S. Nguyen `5005`; customer portal
`k.alvarez@meridian-aero.com` / `meridian-demo`.

## Run (human path)

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

Open `http://localhost:5173`. `--reload` is fine here since it's
foregrounded in its own terminal; drop it for the backgrounded agent path
above (the reloader spawns a child process that's harder to `pkill` cleanly).

## Test

No automated test suite in this repo as of this branch (`feat/erp-implementation`) —
verification here was manual, via the driver above.

## Gotchas

- **`chromium-cli` isn't installed in this container.** `driver.mjs` is the
  substitute — same nav/wait-for/click/fill/screenshot vocabulary, built
  directly on Playwright (`chromium.launch({ args: ['--no-sandbox'] })`).
  If `chromium-cli` becomes available later, prefer it and drop this driver.
- **Login inputs have no `name`/`id` attributes** (`frontend/src/pages/LoginPage.tsx`)
  — select by `input[type=email]` / `input[type=password]`, not by name.
- **Dashboard loads asynchronously.** Right after `wait-for text=Dashboard`
  the page still shows "Loading dashboard…" — add `sleep 2000` (or
  `wait-for` a data element like `text=Jobs in WIP`) before screenshotting,
  or you'll capture an empty shell.
- **Playwright browsers aren't cached by default** — first `npx playwright
  install --with-deps chromium` pulls ~300MB and apt-installs Xvfb/font
  packages; only needed once per container.

## Troubleshooting

- **`curl: (7) Failed to connect ... port 8000`**: uvicorn not up yet or
  crashed — check `/tmp/backend.log`. Common cause: Postgres not running
  (`sudo service postgresql start`) or venv not activated before `uvicorn`.
- **`Cannot find module 'playwright'`**: driver run from the wrong
  directory, or `npm install` never ran inside
  `.claude/skills/run-erp/`. It has its own `package.json` — dependencies
  aren't shared with `frontend/`.
