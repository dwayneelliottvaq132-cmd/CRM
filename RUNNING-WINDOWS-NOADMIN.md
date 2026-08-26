# Running the Texas Precision Plating ERP on Windows without admin rights

Companion to `RUNNING.md` (general reference), `setup-ubuntu.sh` (Linux/ChromeOS), and
`RUNNING-MAC.md` (macOS). This path is for a Windows machine where you can install
**per-user** software (no admin password prompt) but cannot do anything system-wide —
no WSL2 (needs admin to enable), no PostgreSQL Windows service, no system PATH edits.

Everything below is extract-and-run or per-user-installer only. It's more steps than
the Mac/Linux guides because PostgreSQL doesn't offer an official no-admin path — we
run it as a plain background process instead of a Windows service.

## 1. Git

Download **Git for Windows** from https://git-scm.com/download/win. Run the installer —
on the "Select Components" / destination screen, it defaults to installing into your
user profile and does **not** require admin unless you change it. If it prompts for
admin anyway, use the portable "PortableGit" `.7z` from the same release page instead:
extract it anywhere (e.g. `C:\Users\<you>\PortableGit`) and use `git-bash.exe` inside it
for all commands below.

## 2. Python

Download the Windows installer from https://www.python.org/downloads/ (3.12 or 3.13).
Run it and click **"Install Now"** (the default) — this installs to
`%LOCALAPPDATA%\Programs\Python\Python3xx`, per-user, no admin needed. Only the
**"Install for all users"** customize option requires admin — don't pick that.

Verify in a new terminal:
```powershell
python --version
```

## 3. Node.js (portable zip — no installer)

Go to https://nodejs.org/en/download, pick **Windows Binary (.zip)**, and extract it to
somewhere in your user folder, e.g. `C:\Users\<you>\node`. Add it to your **user** PATH
(this does not need admin — it's the "User variables" half of the Environment Variables
dialog, not "System variables"):

1. Start menu → search "environment variables" → **"Edit environment variables for your account"**
   (note: *not* "...for this system", which needs admin)
2. Under "User variables", select `Path` → Edit → New → paste the path to the `node`
   folder you extracted (the one containing `node.exe`)
3. Open a new terminal and verify:
```powershell
node --version
npm --version
```

## 4. PostgreSQL (portable zip, run as a plain process — no service)

1. Download the **zip archive** (not the installer) from
   https://www.enterprisedb.com/download-postgresql-binaries — pick Windows x86-64.
2. Extract to `C:\Users\<you>\pgsql`.
3. Open a terminal in `C:\Users\<you>\pgsql\bin` and initialize a data directory
   (anywhere in your user folder — this is *not* `Program Files`):
```powershell
cd C:\Users\<you>\pgsql\bin
.\initdb.exe -D C:\Users\<you>\pgsql-data -U postgres
```
   It'll ask for a password for the `postgres` superuser — pick anything, you won't need
   it again after step 5.
4. Start Postgres as a background process (leave this terminal open, or use
   `pg_ctl start` which detaches and lets you close the window):
```powershell
.\pg_ctl.exe -D C:\Users\<you>\pgsql-data -l C:\Users\<you>\pgsql-data\log.txt start
```
5. Create the app's role + database:
```powershell
.\createuser.exe -U postgres --createdb --pwprompt surftec
# when prompted, set the password to: surftec_dev_pw   (or your own — just match it in .env below)
.\createdb.exe -U postgres --owner=surftec surftec_erp
```

To stop Postgres later: `.\pg_ctl.exe -D C:\Users\<you>\pgsql-data stop`. To start it
again after a reboot, repeat step 4 (it's not a service, so it won't auto-start).

## 5. Get the code

```powershell
git clone -b feat/erp-implementation https://github.com/dwayneelliottvaq132-cmd/ERP.git tpp-erp
cd tpp-erp
```

## 6. (Optional) Real Steelhead data

If you have `tpp_export.sqlite.gz`, put the decompressed `.sqlite` file at
`backend\data\tpp_export.sqlite`. Git Bash (from step 1) can `gunzip` it the same way
as on Mac/Linux:
```bash
mkdir -p backend/data
gunzip -c /c/Users/<you>/Downloads/tpp_export.sqlite.gz > backend/data/tpp_export.sqlite
file backend/data/tpp_export.sqlite   # should say "SQLite 3.x database"
```
If it still says "gzip compressed data" after one `gunzip`, run it through `gunzip`
again — some transfer paths double-compress it.

## 7. Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend\.env`:
```
DATABASE_URL=postgresql+psycopg://surftec:surftec_dev_pw@localhost:5432/surftec_erp
SECRET_KEY=change-me-to-something-random
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ANTHROPIC_API_KEY=
```
Generate a real `SECRET_KEY`:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Run migrations and load data:
```powershell
alembic upgrade head

# EITHER the fictional demo dataset...
python seed.py

# ...OR real data, if backend\data\tpp_export.sqlite exists (step 6):
python import_real_data.py
```

Start the backend (leave this window open):
```powershell
uvicorn app.main:app --reload --port 8000
```

## 8. Frontend setup

Open a **new terminal**:
```powershell
cd tpp-erp\frontend
npm install
echo VITE_API_BASE_URL=http://localhost:8000/api/v1 > .env
npm run dev
```

## 9. Open it

```
http://localhost:5173
```

**Login (`seed.py` demo data):** `m.torres@surftec.com` / `surftec-demo`
**Login (`import_real_data.py` real data):** `dwayne.elliott@texasprecision.net` / `surftec-demo`

## Troubleshooting

**Postgres won't start / "could not connect to server":** it's not running as a
service, so it doesn't survive a reboot — repeat step 4's `pg_ctl start` command.

**`pip install` or `npm install` tries to write somewhere it can't:** make sure you're
inside the venv (`.venv\Scripts\activate` — prompt should show `(.venv)`) and that
`tpp-erp` itself is somewhere in your user profile (e.g. `C:\Users\<you>\tpp-erp`), not
a shared/network drive.

**Corporate antivirus/Defender flags `pg_ctl.exe` or `node.exe`:** common with portable
binaries on managed devices — you may need your IT department to allowlist the
extracted folder, since you can't approve it yourself without admin.
