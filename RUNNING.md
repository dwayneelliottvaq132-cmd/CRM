# Running the Texas Precision Plating ERP

Implementation of the `NADCAP ERP.dc.html` design: a NADCAP/AS9100D paperless
ERP for chemical processing (anodizing, chem film, passivation, plating,
paint/prime). FastAPI + Postgres backend, React + TypeScript frontend — now
loaded with **real data imported from the Texas Precision Plating Steelhead
ERP export**.

## Quick start (Ubuntu / Debian / ChromeOS penguin)

One command sets up everything (system packages, Postgres, backend venv +
migrations + demo seed, frontend deps):

```bash
bash setup-ubuntu.sh
```

Then start the two servers as it instructs. The manual steps are below.

## Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Postgres: create a database + role (adjust as needed)
sudo -u postgres psql -c "CREATE USER surftec WITH PASSWORD 'surftec_dev_pw' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE surftec_erp OWNER surftec;"

alembic upgrade head            # create schema

# EITHER load the real Texas Precision Plating data (preferred)…
#   place the Steelhead sqlite export at backend/data/tpp_export.sqlite
#   (this path is gitignored — the export contains live customer data, never commit it)
python3 import_real_data.py

# …OR load the fictional SURFTEC demo dataset from the original design mockup:
# python3 seed.py

uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs (OpenAPI 3.1)
- Config via `backend/.env` (see `app/core/config.py` for all settings, e.g.
  `DATABASE_URL`, `SECRET_KEY`, `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`).

### Logins after `import_real_data.py` (real data)

- ERP login: `dwayne.elliott@texasprecision.net` / `surftec-demo`
  (chosen as Quality Manager because that user authored the most quality
  records in the export; all other staff import as Operators)
- Shop-floor PINs: printed by the import script at the end of its run.
  Dwayne Elliott is always `1001`. These are demo PINs — replace with real
  operator enrollment before production use.
- Customer portal: one login per imported customer, built from the first
  active real contact on file — password `portal-demo` for all of them.

### Logins after `seed.py` (fictional demo data)

- ERP login: `m.torres@surftec.com` / `surftec-demo`
- Shop-floor PINs: Torres `1001`, J. Kim `2002`, D. Ochoa `3003`,
  R. Patel `4004`, S. Nguyen `5005`
- Portal: `k.alvarez@meridian-aero.com` / `meridian-demo`

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

`frontend/.env` sets `VITE_API_BASE_URL` (defaults to
`http://localhost:8000/api/v1`).

## What's implemented

All 14 modules from the design: Dashboard, Orders & Quotes, Travelers (job
routers), Shop Floor (PIN sign-off terminal), Bath Chemistry, Compliance
(NCR/CAPA/audit readiness), Certs & C of C (PDF generation), Invoicing
(QuickBooks Online sync), Calibration, Inventory, Vendors, Document Control,
Customer Portal (preview + real external login), and API & Integrations.

Business rules enforced server-side (not just cosmetic):

- A tank logged out-of-control auto-holds and blocks sign-off on any
  operation tied to it, until a passing re-analysis is logged.
- Overdue calibration equipment blocks sign-off on any operation requiring it.
- A Certificate of Conformance can't be issued unless every operation is
  signed off, no tank it touched was out-of-control at signoff time, and no
  failed spec result is unresolved.
- **A job cannot ship with a failed spec.** `POST /jobs/{id}/ship` is blocked
  while any in-process spec check is failing — unless a later re-test of the
  same parameter passed, or a Quality Manager explicitly dispositions it with
  a note (MRB-style, audited). Unsigned operations and NCR holds also block.
- Every mutation writes an immutable audit-log row (who/what/when/before/after).
- Webhooks fire (logged, simulated delivery) on `job.status_changed`,
  `ncr.opened`, `invoice.paid`.

## The real-data import (`backend/import_real_data.py`)

The Steelhead export has 251 tables; this app's schema covers the 14 designed
screens, so the import maps the matching subset and takes a **recent slice**
(newest 45 work orders, 30 invoices, 15 quotes, plus every customer/vendor/
user/spec they reference). Every imported row stores the source id in
`external_id`, so re-running the script updates rather than duplicates.

Mapping summary:

| This app            | Steelhead source                                                       |
| ------------------- | ---------------------------------------------------------------------- |
| Job + operations    | `work_order` + its `recipe_node` steps; sign-offs from `parts_transfer` |
| Order / Quote       | `received_order` (+lines) / `quote` (+lines)                            |
| Tank                | `station` (via `station_treatment`); readings from `sensor_measurement`; holds from open `quality_hold` accounts |
| NCR / CAPA          | `non_conformance_report` (+investigation/response) / `corrective_action_report` |
| Certificate         | `cert_report`, linked to jobs via the spec-value → parts-transfer chain  |
| Invoice + lines     | `invoice` + `invoice_line_item` (micro-dollars → dollars)                |
| Inventory lot       | `inventory_batch` for items typed "Controlled Production Chemicals"; on-hand from `inventory_transfer` ledger |
| Document            | `spec` (customer/industry specs — TPP's QMS docs aren't in the export)   |
| Spec result         | `spec_value_parts_transfer_account` (`is_failing`) + param name/limits from `spec_field` / `spec_field_param` |
| Compliance pulse    | computed from `insights_customer_on_time` / `insights_first_time_through` |

### Known caveats

- **Operation order is approximate.** Steelhead models routing as a process
  graph (`process_node_relationship`); the import orders each work order's
  `recipe_node` steps by id (creation order), which is close but not
  authoritative. Blocked/complete logic still behaves correctly.
- **Equipment/Calibration is placeholder.** The export's `equipment` and
  maintenance tables are empty — TPP doesn't track calibration in Steelhead.
  The Calibration screen shows clearly-illustrative seeded assets.
- **Tank control limits are not numeric.** Steelhead stores bath chemistry as
  spec-field params per recipe, not per-tank control limits, so tanks show
  "Per governing spec" and hold state comes from open quality holds. Logging
  a numeric analysis in this app works, but limits need to be entered per tank.
- **Vendor OTD % is a constant** (not tracked in the export); approval basis
  and risk status are real (from Steelhead's vendor custom fields).
- **ITAR flags default to false** — the export doesn't tag customers/jobs as
  ITAR. Set `itar_registered` / `itar` manually where applicable.
- The live system at app.gosteelhead.com could not be reached from this
  environment (host not in the network allowlist), so verification was done
  against the export only.

## AI Drawing Scan (Claude)

`/drawings` scans a customer PDF drawing with Claude (Messages API, PDF vision
+ JSON-schema structured output, model `claude-opus-4-8`) and extracts:

- **Processing requirements** — every finish/plating callout with its governing
  spec (MIL-A-8625, MIL-DTL-5541, AMS 2700…), type/class, thickness/color/seal
  notes, and masking / keep-free areas.
- **Surface area** — estimated total wetted area of one part in in², with the
  per-feature breakdown, the geometry assumptions used, and a confidence rating.

Set `ANTHROPIC_API_KEY` in `backend/.env` to enable. Without it the endpoint
returns 503 and the UI shows a "not configured" banner — results are never
simulated, since fabricated engineering data could mislead quoting. Every scan
is persisted (`drawing_analyses` table, full raw model output kept) and
audit-logged; results are advisory and reviewed by a person before use.

## QuickBooks Online

Real OAuth2 + `python-quickbooks` integration code is in
`backend/app/integrations/quickbooks.py`. Without `QBO_CLIENT_ID` /
`QBO_CLIENT_SECRET` set, invoice sync is simulated (same UI/API contract,
no live Intuit calls) so the app works out of the box. Set those two env
vars plus `QBO_REDIRECT_URI` to a registered QuickBooks Developer app to go
live — then `GET /api/v1/quickbooks/authorize` starts the real OAuth flow.
