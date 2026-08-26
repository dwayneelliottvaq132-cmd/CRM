"""Imports a recent slice of real data from a Steelhead ERP export (sqlite) into
this app's schema, replacing the fictional SURFTEC/Meridian demo data.

Source: backend/data/tpp_export.sqlite (Texas Precision Plating's real export —
NEVER commit this file; it's gitignored). 251 source tables; we align our existing
14-screen schema's field/terms to the subset that matches (customer, vendor,
work_order, quote, received_order, recipe_node, parts_transfer, station,
non_conformance_report, corrective_action_report, cert_report, invoice,
inventory_item, spec, user). See RUNNING.md for the full mapping + caveats
(equipment/calibration has zero real rows in this export; recipe_node step
ordering is approximated by id/creation-order, not the true process graph).

Idempotent: every imported row carries `external_id` = the source table's
integer id, so re-running updates existing rows instead of duplicating them.

    python import_real_data.py
"""

import datetime as dt
import json
import sqlite3
from pathlib import Path

from sqlalchemy import select

from app.core.security import hash_pin_lookup, hash_secret
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.certificate import Certificate
from app.models.chemistry import Tank
from app.models.compliance import CAPA, NCR, CompanyMetric
from app.models.customer import Customer, Vendor
from app.models.document import Document
from app.models.inventory import InventoryLot
from app.models.invoice import Invoice, InvoiceLine
from app.models.job import Job, JobOperation, SpecResult
from app.models.order import Order
from app.models.user import PortalUser, User

SQLITE_PATH = Path(__file__).parent / "data" / "tpp_export.sqlite"

RECENT_JOB_LIMIT = 45
RECENT_QUOTE_LIMIT = 15
RECENT_INVOICE_LIMIT = 30
RECENT_RECEIVED_ORDER_LIMIT = 20
RECENT_INVENTORY_BATCH_LIMIT = 40

OPERATIONAL_NODE_TYPES = (
    "process", "step", "staging", "racking", "unracking",
    "quality_assurance_node", "contract_review_node",
    "step_shipping", "step_shipping_ready", "step_shipping_packed", "step_shipping_shipped",
)


def sconn() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{SQLITE_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def rows(conn, sql, params=()) -> list[sqlite3.Row]:
    return conn.execute(sql, params).fetchall()


def one(conn, sql, params=()) -> sqlite3.Row | None:
    return conn.execute(sql, params).fetchone()


def parse_json(text: str | None) -> dict:
    if not text:
        return {}
    try:
        val = json.loads(text)
        return val if isinstance(val, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def to_date(ts: str | None) -> dt.date | None:
    if not ts:
        return None
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).date()


def to_datetime(ts: str | None) -> dt.datetime | None:
    if not ts:
        return None
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def clip(text: str | None, n: int, fallback: str = "") -> str:
    text = (text or "").strip() or fallback
    return text[:n]


def get_or_create_by_id(db, Model, code: str, **fields):
    obj = db.get(Model, code)
    if obj is None:
        obj = Model(id=code, **fields)
        db.add(obj)
    else:
        for k, v in fields.items():
            setattr(obj, k, v)
    return obj


def get_or_create_by_external(db, Model, external_id, **fields):
    ext = str(external_id)
    obj = db.execute(select(Model).where(Model.external_id == ext)).scalar_one_or_none()
    if obj is None:
        obj = Model(external_id=ext, **fields)
        db.add(obj)
        db.flush()
    else:
        for k, v in fields.items():
            setattr(obj, k, v)
    return obj


# --------------------------------------------------------------------------- users


def import_users(db, conn) -> dict[int, User]:
    print("Importing users...")
    user_map: dict[int, User] = {}
    pin_list: list[tuple[str, str]] = []
    src_rows = rows(conn, "SELECT id, name, created_at FROM user WHERE archived_at IS NULL ORDER BY id")
    for i, r in enumerate(src_rows):
        name = clip(r["name"], 120, f"User {r['id']}")
        slug = name.lower().replace(" ", ".").replace(",", "")
        pin = str(1112 + i * 111)  # demo PINs (1001 reserved for the QM) — replace with real enrollment in production
        u = get_or_create_by_external(
            db, User, r["id"],
            name=name, initials="".join(w[0] for w in name.split()[:2]).upper() or "U",
            email=f"{slug}@texasprecision.net", role="Operator",
            pin_hash=hash_secret(pin), pin_lookup_hash=hash_pin_lookup(pin),
        )
        user_map[r["id"]] = u
        pin_list.append((name, pin))
    db.flush()

    # App login identity: the real user who authored the most quality records is our Quality Manager.
    qm_row = one(conn, """
        SELECT creator_id, COUNT(*) c FROM (
            SELECT creator_id FROM non_conformance_report
            UNION ALL SELECT creator_id FROM corrective_action_report
            UNION ALL SELECT creator_id FROM quote
        ) GROUP BY creator_id ORDER BY c DESC LIMIT 1
    """)
    if qm_row and qm_row["creator_id"] in user_map:
        qm = user_map[qm_row["creator_id"]]
    else:
        qm = next(iter(user_map.values()), None)
    if qm is not None:
        qm.role = "Quality Manager"
        qm.password_hash = hash_secret("surftec-demo")
        qm.pin_hash = hash_secret("1001")
        qm.pin_lookup_hash = hash_pin_lookup("1001")
        pin_list = [(n, ("1001" if n == qm.name else p)) for n, p in pin_list]
    db.flush()
    print(f"  {len(user_map)} users. Quality Manager login: {qm.email if qm else 'none'} / surftec-demo")
    print("  Shop-floor PINs (demo):")
    for name, pin in pin_list:
        print(f"    {pin}  {name}")
    return user_map


# ------------------------------------------------------------------------ vendors


def import_vendors(db, conn) -> dict[int, Vendor]:
    print("Importing vendors...")
    vendor_map: dict[int, Vendor] = {}
    for r in rows(conn, "SELECT id, name, custom_input FROM vendor WHERE archived_at IS NULL ORDER BY id"):
        custom = parse_json(r["custom_input"])
        risk = custom.get("risk", "")
        method = custom.get("methodApproval", "")
        scope = custom.get("scopeApproval", "")
        status = "Conditional" if risk.lower() == "high" else "Approved"
        basis = ", ".join(x for x in [method, scope.strip() if scope else ""] if x) or "Cert review"
        v = get_or_create_by_external(
            db, Vendor, r["id"],
            name=clip(r["name"], 200, f"Vendor {r['id']}"),
            category="Process supplier",
            approval_basis=clip(basis, 200),
            otd_pct=95.0,  # not tracked in source export
            status=status,
        )
        vendor_map[r["id"]] = v
    db.flush()
    print(f"  {len(vendor_map)} vendors")
    return vendor_map


# --------------------------------------------------------------------- documents


def import_documents(db, conn, spec_ids: set[int]) -> dict[int, Document]:
    print("Importing documents (from specs)...")
    doc_map: dict[int, Document] = {}
    if not spec_ids:
        return doc_map
    placeholders = ",".join("?" * len(spec_ids))
    for r in rows(conn, f"""
        SELECT id, name, revision_name, description_external, created_at, archived_at
        FROM spec WHERE id IN ({placeholders}) ORDER BY id
    """, tuple(spec_ids)):
        doc_no = f"SPEC-{r['id']}"
        title = clip(r["description_external"], 400) or clip(r["name"], 400, f"Spec {r['id']}")
        d = db.get(Document, doc_no)
        fields = dict(
            title=title,
            revision=clip(r["revision_name"], 5, "A"),
            effective_date=to_date(r["created_at"]),
            owner="Quality",
            status="Superseded" if r["archived_at"] else "Released",
            external_id=str(r["id"]),
        )
        if d is None:
            d = Document(doc_no=doc_no, **fields)
            db.add(d)
        else:
            for k, v in fields.items():
                setattr(d, k, v)
        doc_map[r["id"]] = d
    db.flush()
    print(f"  {len(doc_map)} documents")
    return doc_map


# --------------------------------------------------------------------- customers


def import_customers(db, conn, customer_ids: set[int]) -> dict[int, Customer]:
    print("Importing customers...")
    customer_map: dict[int, Customer] = {}
    if not customer_ids:
        return customer_map
    placeholders = ",".join("?" * len(customer_ids))
    for r in rows(conn, f"SELECT id, name FROM customer WHERE id IN ({placeholders})", tuple(customer_ids)):
        c = get_or_create_by_external(
            db, Customer, r["id"],
            name=clip(r["name"], 200, f"Customer {r['id']}") or f"Customer {r['id']}",
            itar_registered=False,
        )
        customer_map[r["id"]] = c
    db.flush()

    # A couple of portal-contact logins per customer, from real contacts flagged relevant.
    contact_rows = rows(conn, f"""
        SELECT id, customer_id, name, email FROM customer_contact
        WHERE customer_id IN ({placeholders}) AND email IS NOT NULL AND archived_at IS NULL
        ORDER BY customer_id, id
    """, tuple(customer_ids))
    seen_customers: set[int] = set()
    for r in contact_rows:
        if r["customer_id"] in seen_customers or r["customer_id"] not in customer_map:
            continue
        seen_customers.add(r["customer_id"])
        get_or_create_by_external(
            db, PortalUser, r["id"],
            name=clip(r["name"], 120, "Portal Contact"),
            email=r["email"].strip().lower(),
            password_hash=hash_secret("portal-demo"),
            customer_id=customer_map[r["customer_id"]].id,
        )
    db.flush()
    print(f"  {len(customer_map)} customers, {len(seen_customers)} portal logins (password: portal-demo)")
    return customer_map


# ------------------------------------------------------------------------- tanks


def get_or_create_tank(db, conn, station_id: int, tank_cache: dict[int, Tank]) -> Tank | None:
    if station_id in tank_cache:
        return tank_cache[station_id]
    st = one(conn, "SELECT id, name FROM station WHERE id = ?", (station_id,))
    if st is None:
        return None

    sensor_row = one(conn, """
        SELECT s.name AS sensor_name, sm.measurement, sm.effective_at
        FROM sensor s JOIN sensor_measurement sm ON sm.sensor_id = s.id
        WHERE s.station_id = ? ORDER BY sm.effective_at DESC LIMIT 1
    """, (station_id,))

    hold_row = one(conn, """
        SELECT qh.description_markdown FROM parts_transfer_account pta
        JOIN quality_hold qh ON qh.id = pta.quality_hold_id
        WHERE pta.station_id = ? AND pta.exited_at IS NULL LIMIT 1
    """, (station_id,))

    tank = get_or_create_by_id(
        db, Tank, f"ST-{station_id}",
        solution=clip(st["name"], 120, f"Station {station_id}"),
        parameter=clip(sensor_row["sensor_name"], 60, "See governing spec") if sensor_row else "See governing spec",
        limits_text="Per governing spec",
        last_result=sensor_row["measurement"] if sensor_row else None,
        last_analyzed_at=to_datetime(sensor_row["effective_at"]) if sensor_row else None,
        held=hold_row is not None,
        hold_reason=clip(hold_row["description_markdown"], 255) if hold_row else None,
        external_id=str(station_id),
    )
    db.flush()
    tank_cache[station_id] = tank
    return tank


# --------------------------------------------------------------------------- jobs

JOB_STATUS_SHIP_TYPES = {"step_shipping_shipped", "step_shipping_packed", "step_shipping_ready", "step_shipping", "quality_assurance_node"}


def recent_work_order_ids(conn, limit: int) -> list[int]:
    return [r["id"] for r in rows(conn, """
        SELECT id FROM work_order WHERE archived_at IS NULL
        ORDER BY created_at DESC LIMIT ?
    """, (limit,))]


def import_jobs(db, conn, wo_ids: list[int], customer_map: dict[int, Customer], doc_map: dict[int, Document], user_map: dict[int, User], tank_cache: dict[int, Tank]) -> dict[int, Job]:
    print(f"Importing {len(wo_ids)} jobs (work orders) + operations...")
    job_map: dict[int, Job] = {}
    if not wo_ids:
        return job_map
    placeholders = ",".join("?" * len(wo_ids))
    wo_rows = rows(conn, f"""
        SELECT id, customer_id, created_at, completed_at, deadline, id_in_domain, received_order_id
        FROM work_order WHERE id IN ({placeholders})
    """, tuple(wo_ids))

    for wo in wo_rows:
        if wo["customer_id"] not in customer_map:
            continue
        code = f"WO-{wo['id_in_domain'] or wo['id']}"

        customer_po = code
        if wo["received_order_id"]:
            ro_row = one(conn, "SELECT name FROM received_order WHERE id = ?", (wo["received_order_id"],))
            if ro_row and ro_row["name"]:
                customer_po = clip(ro_row["name"], 60, code)

        qty_row = one(conn, "SELECT MAX(part_count) AS qty FROM parts_transfer_account WHERE work_order_id = ?", (wo["id"],))
        qty = int(qty_row["qty"]) if qty_row and qty_row["qty"] else 1

        pn_row = one(conn, """
            SELECT pn.id, pn.name, pn.short_name FROM part_number_work_order pnwo
            JOIN part_number pn ON pn.id = pnwo.part_number_id
            WHERE pnwo.work_order_id = ? AND pnwo.archived_at IS NULL
            ORDER BY pnwo.id LIMIT 1
        """, (wo["id"],))
        part_number = clip(pn_row["name"], 60, code) if pn_row else code

        spec_text, spec_id = None, None
        if pn_row:
            price_row = one(conn, """
                SELECT custom_inputs, process_node_id FROM part_number_price
                WHERE part_number_id = ? ORDER BY created_at DESC LIMIT 1
            """, (pn_row["id"],))
            if price_row:
                spec_text = parse_json(price_row["custom_inputs"]).get("partProcess")
            spec_row = one(conn, "SELECT spec_id FROM part_number_spec WHERE part_number_id = ? LIMIT 1", (pn_row["id"],))
            if spec_row:
                spec_id = spec_row["spec_id"]

        op_rows = rows(conn, f"""
            SELECT id, name, type, treatment_id FROM recipe_node
            WHERE work_order_id = ? AND type IN ({",".join("?" * len(OPERATIONAL_NODE_TYPES))})
            ORDER BY id
        """, (wo["id"], *OPERATIONAL_NODE_TYPES))

        treatment_name = None
        for op in op_rows:
            if op["treatment_id"]:
                t = one(conn, "SELECT name FROM treatment WHERE id = ?", (op["treatment_id"],))
                if t:
                    treatment_name = clip(t["name"], 120)
                    break

        job = get_or_create_by_id(
            db, Job, code,
            customer_id=customer_map[wo["customer_id"]].id,
            customer_po=customer_po,
            part_number=part_number,
            revision="A",
            qty=qty,
            material_lot=f"WO-{wo['id']}",
            process_label=treatment_name or "Process",
            spec=clip(spec_text, 120) if spec_text else (f"SPEC-{spec_id}" if spec_id else "Per customer PO"),
            spec_note="",
            due_date=to_date(wo["deadline"]),
            due_note="",
            itar=False,
            status="Queued",
            governing_doc_no=doc_map[spec_id].doc_no if spec_id and spec_id in doc_map else None,
            external_id=str(wo["id"]),
        )
        db.flush()

        done_count = 0
        for i, op in enumerate(op_rows):
            tank = None
            if op["treatment_id"]:
                station_row = one(conn, "SELECT station_id FROM station_treatment WHERE treatment_id = ? LIMIT 1", (op["treatment_id"],))
                if station_row:
                    tank = get_or_create_tank(db, conn, station_row["station_id"], tank_cache)

            xfer = one(conn, """
                SELECT creator_id, at FROM parts_transfer
                WHERE to_recipe_node_id = ? AND type = 'complete'
                ORDER BY at DESC LIMIT 1
            """, (op["id"],))
            done = xfer is not None
            if done:
                done_count += 1
            signed_by = user_map[xfer["creator_id"]].name if done and xfer["creator_id"] in user_map else ("Unknown" if done else None)

            jop = get_or_create_by_external(
                db, JobOperation, f"recipe_node:{op['id']}",
                job_id=job.id, seq=(i + 1) * 10, name=clip(op["name"], 120, f"Step {i + 1}"),
                parameters="Per governing spec", tank_id=tank.id if tank else None,
                done=done, signed_by=signed_by,
                signed_at=to_datetime(xfer["at"]) if done else None,
            )

        if wo["completed_at"]:
            status = "Complete"
        elif done_count == 0:
            status = "Queued"
        elif op_rows and op_rows[-1]["type"] in JOB_STATUS_SHIP_TYPES and done_count == len(op_rows):
            status = "Final Inspect"
        else:
            status = "In Process"
        job.status = status
        db.flush()
        job_map[wo["id"]] = job

    print(f"  {len(job_map)} jobs imported")
    return job_map


# ------------------------------------------------------------------------- orders


def import_orders(db, conn, customer_map: dict[int, Customer], job_map: dict[int, Job]) -> None:
    print("Importing orders (received_order) and quotes...")
    wo_by_received_order: dict[int, Job] = {}
    placeholders = ",".join("?" * len(job_map)) if job_map else "NULL"
    if job_map:
        for r in rows(conn, f"SELECT id, received_order_id FROM work_order WHERE id IN ({placeholders})", tuple(job_map.keys())):
            if r["received_order_id"]:
                wo_by_received_order[r["received_order_id"]] = job_map[r["id"]]

    n_orders = 0
    if wo_by_received_order:
        ro_placeholders = ",".join("?" * len(wo_by_received_order))
        for ro in rows(conn, f"""
            SELECT id, name, customer_id, created_at, deadline, id_in_domain, computed_price_usd
            FROM received_order WHERE id IN ({ro_placeholders})
        """, tuple(wo_by_received_order.keys())):
            if ro["customer_id"] not in customer_map:
                continue
            line = one(conn, "SELECT name FROM received_order_line WHERE received_order_id = ? ORDER BY id LIMIT 1", (ro["id"],))
            job = wo_by_received_order[ro["id"]]
            get_or_create_by_id(
                db, Order, f"SO-{ro['id_in_domain'] or ro['id']}",
                kind="order", customer_id=customer_map[ro["customer_id"]].id,
                customer_po=clip(ro["name"], 60, f"RO-{ro['id']}"),
                part_number=job.part_number, spec=job.spec, qty=job.qty,
                value=float(ro["computed_price_usd"] or 0),
                due_date=to_date(ro["deadline"]),
                status="Converted", converted_job_id=job.id,
                external_id=str(ro["id"]),
            )
            n_orders += 1
    db.flush()

    QUOTE_STATUS = {
        "Expired": "Quote — Draft", "Order Received": "Converted",
        "Active / Sent": "Quote — Sent", "Active / Opened": "Quote — Review", "Created": "Quote — Draft",
    }
    n_quotes = 0
    for q in rows(conn, """
        SELECT id, name, customer_id, created_at, valid_until, id_in_domain, computed_price_usd, current_status_name
        FROM quote WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT ?
    """, (RECENT_QUOTE_LIMIT,)):
        if q["customer_id"] not in customer_map:
            continue
        line = one(conn, "SELECT title, description FROM quote_line WHERE quote_id = ? ORDER BY id LIMIT 1", (q["id"],))
        get_or_create_by_id(
            db, Order, f"QT-{q['id_in_domain'] or q['id']}",
            kind="quote", customer_id=customer_map[q["customer_id"]].id,
            customer_po=clip(q["name"], 60, f"Q-{q['id']}") or f"Q-{q['id']}",
            part_number=clip(line["title"], 60, "—") if line else "—",
            spec=clip(line["description"], 120, "—") if line else "—",
            qty=1, value=float(q["computed_price_usd"] or 0),
            due_date=to_date(q["valid_until"]),
            status=QUOTE_STATUS.get(q["current_status_name"], "Quote — Draft"),
            external_id=str(q["id"]),
        )
        n_quotes += 1
    db.flush()
    print(f"  {n_orders} orders, {n_quotes} quotes")


# ------------------------------------------------------------------- NCR / CAPA


def import_ncr_capa(db, conn, job_map: dict[int, Job]) -> None:
    print("Importing NCRs and CAPAs (source has very little real NCR history)...")

    def job_for_ncr(ncr_id: int) -> Job | None:
        r = one(conn, "SELECT work_order_id FROM parts_transfer_account WHERE non_conformance_report_id = ? AND work_order_id IS NOT NULL LIMIT 1", (ncr_id,))
        return job_map.get(r["work_order_id"]) if r else None

    n_ncr = 0
    ncr_job_map: dict[int, str | None] = {}
    for ncr in rows(conn, "SELECT id, created_at, custom_input FROM non_conformance_report"):
        custom = parse_json(ncr["custom_input"])
        inv = one(conn, "SELECT custom_input FROM non_conformance_investigation WHERE non_conformance_report_id = ? ORDER BY id LIMIT 1", (ncr["id"],))
        resp = one(conn, "SELECT custom_input FROM non_conformance_response WHERE non_conformance_report_id = ? ORDER BY id LIMIT 1", (ncr["id"],))
        inv_custom = parse_json(inv["custom_input"]) if inv else {}
        resp_custom = parse_json(resp["custom_input"]) if resp else {}

        desc_parts = [
            f"Location: {custom['location']}" if custom.get("location") else "",
            f"Lot {custom['lotNumber']}" if custom.get("lotNumber") else "",
            custom.get("reportedQualityConcern", ""),
            inv_custom.get("problemStatement", ""),
        ]
        description = clip(" — ".join(p for p in desc_parts if p), 500, "Nonconformance reported.")
        disposition = clip(resp_custom.get("disposition"), 40, "Open — MRB")

        job = job_for_ncr(ncr["id"])
        ncr_obj = get_or_create_by_id(
            db, NCR, f"NCR-{ncr['id']}",
            job_id=job.id if job else None,
            reference_label=job.id if job else f"NCR-{ncr['id']}",
            opened_at=to_date(ncr["created_at"]) or dt.date.today(),
            disposition=disposition,
            description=description,
            external_id=str(ncr["id"]),
        )
        ncr_job_map[ncr["id"]] = ncr_obj.id
        n_ncr += 1
    db.flush()

    n_capa = 0
    for car in rows(conn, "SELECT id, created_at, non_conformance_report_id, completed_at, custom_input FROM corrective_action_report"):
        inv = one(conn, "SELECT custom_input FROM corrective_action_investigation WHERE corrective_action_report_id = ? ORDER BY id LIMIT 1", (car["id"],))
        inv_custom = parse_json(inv["custom_input"]) if inv else {}
        description = clip(
            inv_custom.get("containmentAction") or inv_custom.get("comment") or "Corrective action in progress.",
            500,
        )
        verified = one(conn, "SELECT id FROM corrective_action_verification WHERE corrective_action_id = ? LIMIT 1", (car["id"],))
        phase = "Closed" if car["completed_at"] else ("Verify" if verified else "Implement")

        get_or_create_by_id(
            db, CAPA, f"CAR-{car['id']}",
            ncr_id=ncr_job_map.get(car["non_conformance_report_id"]),
            description=description,
            due_date=None,
            closed_date=to_date(car["completed_at"]),
            phase=phase,
            external_id=str(car["id"]),
        )
        n_capa += 1
    db.flush()
    print(f"  {n_ncr} NCRs, {n_capa} CAPAs")


# ------------------------------------------------------------------- certificates


def import_certificates(db, conn, job_map: dict[int, Job], qm_name: str) -> None:
    print("Importing certificates...")
    if not job_map:
        return
    placeholders = ",".join("?" * len(job_map))
    cert_rows = rows(conn, f"""
        SELECT DISTINCT cr.id AS cert_id, cr.signed_at, cr.archived_at, pta.work_order_id
        FROM cert_report cr
        JOIN spec_value_parts_transfer_account_cert svptac ON svptac.cert_report_id = cr.id
        JOIN spec_value_parts_transfer_account svpta ON svpta.id = svptac.spec_value_parts_transfer_account_id
        JOIN parts_transfer_account pta ON pta.id = svpta.parts_transfer_account_id
        WHERE pta.work_order_id IN ({placeholders})
        ORDER BY cr.signed_at DESC
    """, tuple(job_map.keys()))

    seen_jobs: set[int] = set()
    n = 0
    for r in cert_rows:
        if r["work_order_id"] in seen_jobs:
            continue
        seen_jobs.add(r["work_order_id"])
        job = job_map[r["work_order_id"]]
        get_or_create_by_id(
            db, Certificate, f"CERT-{r['cert_id']}",
            job_id=job.id, qty_accepted=job.qty,
            process_text=f"{job.process_label} — {job.spec}",
            issued=r["archived_at"] is None,
            issued_at=to_datetime(r["signed_at"]),
            issued_by=qm_name,
            external_id=str(r["cert_id"]),
        )
        n += 1
    db.flush()
    print(f"  {n} certificates")


def import_spec_results(db, conn, job_map: dict[int, Job]) -> None:
    """In-process spec checks (etch time, thickness, visual…) with real pass/fail.

    Steelhead records these in spec_value_parts_transfer_account (is_failing flag);
    the param definition (name + min/target/max + unit) lives on spec_field_param /
    spec_field, and the measured number on spec_field_param_value. A job with an
    unresolved failing spec is blocked from shipping in this app.
    """
    print("Importing spec results...")
    if not job_map:
        return
    placeholders = ",".join("?" * len(job_map))
    result_rows = rows(conn, f"""
        SELECT sv.id AS sv_id, sv.is_failing, sv.created_at, pta.work_order_id,
               pn.id AS param_instance_id,
               sf.name AS field_name, sfp.name AS param_name,
               sfp.minimum_value, sfp.target_value, sfp.maximum_value,
               un.name AS unit_name,
               v.number_value, v.boolean_value, v.comment,
               u.name AS recorded_by
        FROM spec_value_parts_transfer_account sv
        JOIN parts_transfer_account pta ON pta.id = sv.parts_transfer_account_id
        LEFT JOIN part_number_recipe_node_spec_field_param pn ON pn.id = sv.part_number_recipe_node_spec_field_param_id
        LEFT JOIN spec_field_param sfp ON sfp.id = pn.spec_field_param_id
        LEFT JOIN spec_field sf ON sf.id = pn.spec_field_id
        LEFT JOIN unit un ON un.id = sfp.unit_id
        LEFT JOIN spec_field_param_value v ON v.id = sv.spec_field_param_value_id
        LEFT JOIN user u ON u.id = sv.creator_id
        WHERE pta.work_order_id IN ({placeholders}) AND sv.archived_at IS NULL
        ORDER BY sv.created_at
    """, tuple(job_map.keys()))

    n = failing = 0
    for r in result_rows:
        job = job_map[r["work_order_id"]]
        name = clip((r["field_name"] or r["param_name"] or "Spec check").strip(), 160)
        unit = f" {r['unit_name']}" if r["unit_name"] else ""
        lo, hi, tgt = r["minimum_value"], r["maximum_value"], r["target_value"]
        if lo is not None and hi is not None:
            requirement = f"{lo:g}–{hi:g}{unit}"
        elif hi is not None:
            requirement = f"max {hi:g}{unit}"
        elif lo is not None:
            requirement = f"min {lo:g}{unit}"
        elif tgt is not None:
            requirement = f"target {tgt:g}{unit}"
        else:
            requirement = ""
        if r["number_value"] is not None:
            value_text = f"{r['number_value']:g}{unit}"
        elif r["boolean_value"] is not None:
            value_text = "Pass" if r["boolean_value"] else "Fail"
        else:
            value_text = clip(r["comment"] or "", 120)
        get_or_create_by_external(
            db, SpecResult, str(r["sv_id"]),
            job_id=job.id,
            param_key=str(r["param_instance_id"] or name),
            name=name,
            requirement=clip(requirement, 160),
            value_text=value_text,
            passed=not r["is_failing"],
            recorded_by=clip(r["recorded_by"] or "", 120),
            recorded_at=to_datetime(r["created_at"]),
        )
        n += 1
        failing += 1 if r["is_failing"] else 0
    db.flush()
    print(f"  {n} spec results ({failing} failing)")


# ---------------------------------------------------------------------- invoices


def import_invoices(db, conn, customer_map: dict[int, Customer], job_map: dict[int, Job]) -> None:
    print("Importing invoices...")
    ro_to_job: dict[int, Job] = {}
    if job_map:
        placeholders = ",".join("?" * len(job_map))
        for r in rows(conn, f"SELECT id, received_order_id FROM work_order WHERE id IN ({placeholders})", tuple(job_map.keys())):
            if r["received_order_id"]:
                ro_to_job[r["received_order_id"]] = job_map[r["id"]]

    inv_rows = rows(conn, """
        SELECT id, id_in_domain, customer_id, created_at, invoiced_at, due_at, total_usd,
               invoice_terms_id, voided_at, manually_marked_as_paid
        FROM invoice WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT ?
    """, (RECENT_INVOICE_LIMIT,))

    today = dt.date(2026, 7, 9)
    n = 0
    for inv in inv_rows:
        if inv["customer_id"] not in customer_map:
            continue
        terms = "Net 30"
        if inv["invoice_terms_id"]:
            t = one(conn, "SELECT terms FROM invoice_terms WHERE id = ?", (inv["invoice_terms_id"],))
            if t and t["terms"]:
                terms = clip(t["terms"], 30, "Net 30")

        if inv["voided_at"]:
            status = "Draft"
        elif inv["manually_marked_as_paid"]:
            status = "Paid"
        elif inv["due_at"] and to_date(inv["due_at"]) and to_date(inv["due_at"]) < today:
            status = "Overdue"
        elif inv["invoiced_at"]:
            status = "Sent"
        else:
            status = "Draft"

        invoice = get_or_create_by_id(
            db, Invoice, f"INV-{inv['id_in_domain'] or inv['id']}",
            customer_id=customer_map[inv["customer_id"]].id,
            amount=float(inv["total_usd"] or 0), terms=terms, status=status,
            qb_sync_status="Not synced",
            external_id=str(inv["id"]),
        )
        db.flush()

        line_rows = rows(conn, """
            SELECT ili.id, ili.sub_total_microdollars, ili.description, ili.received_order_line_item_id, il.name AS line_name
            FROM invoice_line_item ili
            JOIN invoice_line il ON il.id = ili.invoice_line_id
            WHERE ili.invoice_id = ?
        """, (inv["id"],))
        for li in line_rows:
            job_id = None
            if li["received_order_line_item_id"]:
                chain = one(conn, """
                    SELECT rol.received_order_id FROM received_order_line_item roli
                    JOIN received_order_line rol ON rol.id = roli.received_order_line_id
                    WHERE roli.id = ?
                """, (li["received_order_line_item_id"],))
                if chain and chain["received_order_id"] in ro_to_job:
                    job_id = ro_to_job[chain["received_order_id"]].id

            get_or_create_by_external(
                db, InvoiceLine, f"ili:{li['id']}",
                invoice_id=invoice.id, job_id=job_id,
                description=clip(li["description"] or li["line_name"], 255, "Line item"),
                amount=float(li["sub_total_microdollars"] or 0) / 1_000_000,
            )
        n += 1
    db.flush()
    print(f"  {n} invoices")


# --------------------------------------------------------------------- inventory


def import_inventory(db, conn, vendor_map: dict[int, Vendor]) -> None:
    print("Importing inventory (Controlled Production Chemicals only)...")
    chem_type = one(conn, "SELECT id FROM inventory_type WHERE name LIKE '%Chemical%' LIMIT 1")
    if chem_type is None:
        print("  no 'Controlled Production Chemicals' inventory_type found in source — skipping")
        return

    batch_rows = rows(conn, """
        SELECT ib.id, ib.name, ib.inventory_item_id, ib.vendor_id, ib.expiration, ib.created_at,
               ii.name AS item_name, ii.threshold, ii.unit_id
        FROM inventory_batch ib JOIN inventory_item ii ON ii.id = ib.inventory_item_id
        WHERE ib.archived_at IS NULL AND ii.inventory_type_id = ?
        ORDER BY ib.created_at DESC LIMIT ?
    """, (chem_type["id"], RECENT_INVENTORY_BATCH_LIMIT))

    n = 0
    seen_items: set[int] = set()
    for b in batch_rows:
        if b["inventory_item_id"] in seen_items:
            continue
        seen_items.add(b["inventory_item_id"])

        qty_row = one(conn, """
            SELECT SUM(COALESCE(credit_micro_quantity,0) - COALESCE(debit_micro_quantity,0)) / 1000000.0 AS qty
            FROM inventory_transfer WHERE inventory_item_id = ?
        """, (b["inventory_item_id"],))
        on_hand = max(float(qty_row["qty"] or 0), 0.0)

        unit_name = "ea"
        if b["unit_id"]:
            u = one(conn, "SELECT name FROM unit WHERE id = ?", (b["unit_id"],))
            if u and u["name"]:
                unit_name = clip(u["name"], 20, "ea")

        vendor_id = None
        vid = b["vendor_id"]
        if not vid:
            iv = one(conn, "SELECT vendor_id FROM inventory_item_vendor WHERE inventory_item_id = ? LIMIT 1", (b["inventory_item_id"],))
            vid = iv["vendor_id"] if iv else None
        if vid in vendor_map:
            vendor_id = vendor_map[vid].id

        get_or_create_by_external(
            db, InventoryLot, b["inventory_item_id"],
            chemical_name=clip(b["item_name"], 160, f"Item {b['inventory_item_id']}"),
            lot_number=clip(b["name"], 40) or f"BATCH-{b['id']}",
            vendor_id=vendor_id,
            on_hand_qty=round(on_hand, 2),
            on_hand_unit=unit_name,
            reorder_at_qty=round(float(b["threshold"]) if b["threshold"] else max(on_hand * 0.2, 1.0), 2),
            expires_at=to_date(b["expiration"]),
        )
        n += 1
    db.flush()
    print(f"  {n} inventory lots")


# ------------------------------------------------------------------ compliance pulse


def import_compliance_pulse(db, conn) -> None:
    print("Computing real compliance-pulse KPIs...")
    otd_row = one(conn, """
        SELECT
            SUM(CASE WHEN shipment_at <= deadline THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS pct
        FROM insights_customer_on_time
        WHERE deadline IS NOT NULL AND shipment_at IS NOT NULL
    """)
    fpy_row = one(conn, "SELECT AVG(pass_rate) AS avg_rate FROM insights_first_time_through WHERE pass_rate IS NOT NULL")
    ncr_count = one(conn, "SELECT COUNT(*) c FROM non_conformance_report")

    def rate_kind(rate: float | None) -> str:
        if rate is None:
            return "neutral"
        if rate >= 0.9:
            return "good"
        if rate >= 0.75:
            return "warn"
        return "bad"

    otd_rate = otd_row["pct"] if otd_row else None
    fpy_rate = fpy_row["avg_rate"] if fpy_row else None
    otd_pct = f"{otd_rate * 100:.1f}%" if otd_rate is not None else "N/A"
    fpy_pct = f"{fpy_rate * 100:.1f}%" if fpy_rate is not None else "N/A"

    for key, label, value, kind in [
        ("otd", "On-time delivery (all time)", otd_pct, rate_kind(otd_rate)),
        ("fpy", "First-pass yield (all time)", fpy_pct, rate_kind(fpy_rate)),
        ("escapes", "Open NCRs (all time)", str(ncr_count["c"]), "good" if ncr_count["c"] == 0 else "warn"),
        ("nadcap", "Nadcap CP audit", "Schedule not tracked", "neutral"),
        ("as9100", "AS9100D surveillance", "Schedule not tracked", "neutral"),
    ]:
        obj = db.get(CompanyMetric, key)
        if obj is None:
            db.add(CompanyMetric(key=key, label=label, value=value, kind=kind))
        else:
            obj.label, obj.value, obj.kind = label, value, kind
    db.flush()
    print(f"  on-time delivery {otd_pct}, first-pass yield {fpy_pct}, {ncr_count['c']} historical NCR(s)")


# -------------------------------------------------------------------- equipment


def seed_placeholder_equipment(db) -> None:
    """The export has zero rows in `equipment` — this shop doesn't track calibration
    assets in Steelhead yet. These are illustrative placeholders, not real records,
    so the Calibration screen isn't empty; replace once real data exists."""
    import datetime as _dt

    from app.models.equipment import CalibrationRecord, Equipment

    print("Seeding illustrative calibration equipment (source export has none)...")
    rows_ = [
        ("CAL-014", "Coating thickness gauge (XRF)", "Final Inspect", "12 mo", 12, _dt.date(2025, 8, 1), _dt.date(2026, 8, 1)),
        ("CAL-022", "Line temperature controller", "Process floor", "6 mo", 6, _dt.date(2026, 1, 1), _dt.date(2026, 7, 12)),
        ("CAL-031", "pH meter — lab", "Chem lab", "3 mo", 3, _dt.date(2026, 3, 1), _dt.date(2026, 6, 28)),
        ("CAL-008", "DC rectifier shunt", "Process floor", "12 mo", 12, _dt.date(2026, 2, 1), _dt.date(2027, 2, 1)),
        ("CAL-017", "Micrometer set (0-1in)", "Receiving", "12 mo", 12, _dt.date(2025, 11, 1), _dt.date(2026, 11, 1)),
        ("CAL-025", "Conductivity meter — DI water", "Rinse line", "6 mo", 6, _dt.date(2026, 5, 1), _dt.date(2026, 11, 1)),
    ]
    for asset, name, location, interval_text, interval_months, last, due in rows_:
        eq = get_or_create_by_id(
            db, Equipment, asset, name=name, location=location, interval_text=interval_text,
            interval_months=interval_months, last_calibrated_at=last, due_at=due,
        )
        db.flush()
        existing = db.query(CalibrationRecord).filter_by(equipment_id=asset).first()
        if not existing:
            db.add(CalibrationRecord(equipment_id=asset, performed_at=_dt.datetime.combine(last, _dt.time(9, 0)), performed_by="Calibration vendor", result="Pass", next_due_at=due))
    db.flush()


# -------------------------------------------------------------------------- main


def run() -> None:
    print("Resetting schema (this replaces any existing demo/seed data)...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    conn = sconn()
    db = SessionLocal()
    try:
        wo_ids = recent_work_order_ids(conn, RECENT_JOB_LIMIT)
        print(f"Recent slice: {len(wo_ids)} work orders")

        # Gather everything these jobs will need before creating them.
        customer_ids: set[int] = set()
        spec_ids: set[int] = set()
        if wo_ids:
            placeholders = ",".join("?" * len(wo_ids))
            for r in rows(conn, f"SELECT DISTINCT customer_id FROM work_order WHERE id IN ({placeholders})", tuple(wo_ids)):
                if r["customer_id"]:
                    customer_ids.add(r["customer_id"])
            for r in rows(conn, f"""
                SELECT DISTINCT ps.spec_id FROM part_number_work_order pnwo
                JOIN part_number_spec ps ON ps.part_number_id = pnwo.part_number_id
                WHERE pnwo.work_order_id IN ({placeholders})
            """, tuple(wo_ids)):
                if r["spec_id"]:
                    spec_ids.add(r["spec_id"])

        for r in rows(conn, "SELECT customer_id FROM quote WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT ?", (RECENT_QUOTE_LIMIT,)):
            if r["customer_id"]:
                customer_ids.add(r["customer_id"])
        for r in rows(conn, "SELECT customer_id FROM invoice WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT ?", (RECENT_INVOICE_LIMIT,)):
            if r["customer_id"]:
                customer_ids.add(r["customer_id"])

        user_map = import_users(db, conn)
        vendor_map = import_vendors(db, conn)
        customer_map = import_customers(db, conn, customer_ids)
        doc_map = import_documents(db, conn, spec_ids)
        db.commit()

        tank_cache: dict[int, Tank] = {}
        job_map = import_jobs(db, conn, wo_ids, customer_map, doc_map, user_map, tank_cache)
        db.commit()

        import_orders(db, conn, customer_map, job_map)
        import_spec_results(db, conn, job_map)
        import_ncr_capa(db, conn, job_map)
        qm = next((u for u in user_map.values() if u.role == "Quality Manager"), None)
        import_certificates(db, conn, job_map, qm.name if qm else "Quality")
        import_invoices(db, conn, customer_map, job_map)
        import_inventory(db, conn, vendor_map)
        import_compliance_pulse(db, conn)
        seed_placeholder_equipment(db)
        db.commit()

        print("\nImport complete.")
        if qm:
            print(f"  Log in as: {qm.email} / surftec-demo")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
        conn.close()


if __name__ == "__main__":
    if not SQLITE_PATH.exists():
        raise SystemExit(f"Missing {SQLITE_PATH} — copy the export there first (gitignored, never commit it).")
    print(f"Source: {SQLITE_PATH} ({SQLITE_PATH.stat().st_size / 1e6:.0f} MB)")
    run()
