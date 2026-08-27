#!/usr/bin/env bash
#
# One-shot local setup for the Texas Precision Plating ERP on Ubuntu / Debian
# (including the ChromeOS "penguin" Crostini container).
#
# Run it from the repo root:   bash setup-ubuntu.sh
# It is safe to re-run — each step guards against work already done.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_USER=surftec
DB_PASS=surftec_dev_pw
DB_NAME=surftec_erp

echo "==> 1/6  Installing system packages (needs sudo)"
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip postgresql postgresql-contrib curl git
# Node 20 (Ubuntu's default is too old for Vite 6 / React 19)
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> 2/6  Starting PostgreSQL"
sudo service postgresql start

echo "==> 3/6  Creating database role + database (idempotent)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> 4/6  Backend: virtualenv, dependencies, .env, migrations, demo seed"
cd "${REPO_ROOT}/backend"
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL=postgresql+psycopg://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
# If accessing this server from another machine (e.g. an EC2 public IP), add that
# origin here too, comma-separated: CORS_ORIGINS=http://localhost:5173,http://<public-ip>:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Add your Anthropic key here to enable the AI Drawing Scan feature:
ANTHROPIC_API_KEY=
EOF
  echo "    wrote backend/.env (fill in ANTHROPIC_API_KEY to enable AI drawing scan)"
fi

alembic upgrade head
python3 seed.py   # fictional demo dataset; swap for import_real_data.py if you have the export

echo "==> 5/6  Frontend: npm install + .env"
cd "${REPO_ROOT}/frontend"
npm install --no-fund --no-audit
[ -f .env ] || echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env

echo "==> 6/6  Done."
cat <<'EOF'

Setup complete. Start the two servers in two separate terminal tabs:

  Terminal A (backend):
    cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

  Terminal B (frontend):
    cd frontend && npm run dev

Then open http://localhost:5173 in Chrome and log in (seed.py demo data):
    m.torres@surftec.com  /  surftec-demo
    shop-floor PINs: Torres 1001, J. Kim 2002, D. Ochoa 3003, R. Patel 4004, S. Nguyen 5005

API docs: http://localhost:8000/docs
EOF
