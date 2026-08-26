# Running the Texas Precision Plating ERP on macOS

Companion to `RUNNING.md` (the general reference) and `setup-ubuntu.sh` (Linux/ChromeOS
automated setup) — this is the manual, step-by-step path for a Mac. FastAPI + Postgres
backend, React + TypeScript frontend.

Works on both Apple Silicon (M1/M2/M3/M4) and Intel Macs — the commands below are the same
for either.

## 1. Install prerequisites (Homebrew)

If you don't have Homebrew yet:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install everything the app needs:
```bash
brew install postgresql@16 python@3.12 node git
```

## 2. Start PostgreSQL

```bash
brew services start postgresql@16
```

Verify it's running:
```bash
pg_isready
```

## 3. Create the database role + database

```bash
createuser surftec --createdb --pwprompt
# when prompted, set the password to: surftec_dev_pw   (or your own — just match it in .env below)
createdb surftec_erp --owner=surftec
```

If `createuser`/`createdb` aren't found, prefix with the Homebrew Postgres path:
```bash
/opt/homebrew/opt/postgresql@16/bin/createuser surftec --createdb --pwprompt
/opt/homebrew/opt/postgresql@16/bin/createdb surftec_erp --owner=surftec
```
(Intel Macs: swap `/opt/homebrew` for `/usr/local`.)

## 4. Get the code

Clone from GitHub, or from a bundle file if that's how you received it:
```bash
git clone https://github.com/<your-org>/surftec-erp.git
cd surftec-erp
git checkout feat/erp-implementation
```
```bash
# — or, from a git bundle —
git clone ~/Downloads/repo-erp.bundle surftec-erp
cd surftec-erp
git checkout feat/erp-implementation
```

## 5. Backend setup

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend/.env`:
```bash
cat > .env <<'EOF'
DATABASE_URL=postgresql+psycopg://surftec:surftec_dev_pw@localhost:5432/surftec_erp
SECRET_KEY=change-me-to-something-random
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Add your Anthropic key here to enable the AI Drawing Scan feature:
ANTHROPIC_API_KEY=
EOF
```
Generate a proper random `SECRET_KEY` instead of the placeholder:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```
Paste that value in place of `change-me-to-something-random` above.

Run migrations and load data:
```bash
alembic upgrade head

# EITHER the fictional SURFTEC demo dataset...
python3 seed.py

# ...OR real Texas Precision Plating data, if you have the Steelhead export
# placed at backend/data/tpp_export.sqlite (gitignored — never commit it):
# python3 import_real_data.py
```

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```
Leave this running in its own Terminal tab. API docs: http://localhost:8000/docs

## 6. Frontend setup

Open a **new Terminal tab**:
```bash
cd surftec-erp/frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env
npm run dev
```

## 7. Open it

```
http://localhost:5173
```

**Login (`seed.py` demo data):**
- Email: `m.torres@surftec.com`
- Password: `surftec-demo`
- Shop-floor PINs: Torres `1001`, J. Kim `2002`, D. Ochoa `3003`, R. Patel `4004`, S. Nguyen `5005`

**Login (`import_real_data.py` real data):**
- Email: `dwayne.elliott@texasprecision.net`
- Password: `surftec-demo`
- Shop-floor PIN (Dwayne Elliott): `1001` — other operator PINs are printed at the end of the import script's run

## Enabling the AI Drawing Scan feature

Set `ANTHROPIC_API_KEY` in `backend/.env` (see step 5), then restart the backend —
`.env` is only read at startup, so a running server won't pick up the change until
you stop it (`Ctrl+C`) and run `uvicorn` again. Without a key, `/drawings` shows a
"not configured" banner instead of simulating results.

## Restarting servers after any backend code or `.env` change

Backend changes require a manual restart (stop with `Ctrl+C`, rerun the `uvicorn`
command from step 5). The frontend hot-reloads automatically via Vite — no restart
needed for `.tsx`/`.ts` changes.

## Troubleshooting

**`brew services start postgresql@16` doesn't stick / Postgres not running:**
```bash
brew services list        # check status
brew services restart postgresql@16
```

**Port already in use (8000 or 5173):**
```bash
lsof -i :8000              # find the PID
kill -9 <PID>
```

**`psql: FATAL: role "surftec" does not exist` or similar:** the DB role wasn't
created — redo step 3, or connect as your Mac username's default Postgres role
(`psql postgres`) to check what roles exist (`\du`).

**`pip install` fails compiling a package from source:** this repo's
`requirements.txt` is already pinned to versions with prebuilt wheels for modern
Python (3.12/3.13/3.14) — if you hit a compile error anyway, tell me the exact
package/version and I'll adjust the pin.

**Frontend loads but API calls fail / CORS errors in the browser console:**
`backend/.env`'s `CORS_ORIGINS` must include whatever origin you're browsing from.
For local Mac use, `http://localhost:5173` (already in step 5's `.env`) is enough.
