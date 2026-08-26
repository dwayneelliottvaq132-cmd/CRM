"""Seeds the dev database with the same demo dataset as the Claude Design mockup
(project/NADCAP ERP.dc.html) — SURFTEC ERP, Meridian Aerostructures et al. — so the
app is usable immediately. Safe to re-run: it wipes and recreates all rows.

    python seed.py
"""

import datetime as dt

from sqlalchemy import delete

from app.core.security import hash_pin_lookup, hash_secret
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.certificate import Certificate
from app.models.chemistry import Tank, TankAddition, TankAnalysis
from app.models.compliance import CAPA, NCR, AuditProgram, CompanyMetric
from app.models.customer import Customer, Vendor
from app.models.document import Document
from app.models.equipment import CalibrationRecord, Equipment
from app.models.inventory import InventoryLot
from app.models.invoice import Invoice, InvoiceLine
from app.models.job import Job, JobOperation, SpecResult
from app.models.order import Order
from app.models.user import PortalUser, User

D = dt.date


def reset_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def run():
    reset_schema()
    db = SessionLocal()
    try:
        # ---------------------------------------------------------------- customers
        customers = {
            "Meridian Aerostructures": Customer(name="Meridian Aerostructures", itar_registered=True),
            "Falcon Dynamics": Customer(name="Falcon Dynamics", itar_registered=False),
            "Vantage Gear & Actuation": Customer(name="Vantage Gear & Actuation", itar_registered=True),
            "Corvid Space Systems": Customer(name="Corvid Space Systems", itar_registered=True),
            "Apex Rotorcraft": Customer(name="Apex Rotorcraft", itar_registered=False),
            "Halstead Defense": Customer(name="Halstead Defense", itar_registered=True),
        }
        db.add_all(customers.values())
        db.flush()

        # -------------------------------------------------------------------- users
        torres = User(name="M. Torres", initials="MT", email="m.torres@surftec.com", role="Quality Manager",
                      password_hash=hash_secret("surftec-demo"), pin_hash=hash_secret("1001"), pin_lookup_hash=hash_pin_lookup("1001"))
        operators = [
            User(name="J. Kim", initials="JK", email="j.kim@surftec.com", role="Operator", pin_hash=hash_secret("2002"), pin_lookup_hash=hash_pin_lookup("2002")),
            User(name="D. Ochoa", initials="DO", email="d.ochoa@surftec.com", role="Operator", pin_hash=hash_secret("3003"), pin_lookup_hash=hash_pin_lookup("3003")),
            User(name="R. Patel", initials="RP", email="r.patel@surftec.com", role="Operator", pin_hash=hash_secret("4004"), pin_lookup_hash=hash_pin_lookup("4004")),
            User(name="S. Nguyen", initials="SN", email="s.nguyen@surftec.com", role="Operator", pin_hash=hash_secret("5005"), pin_lookup_hash=hash_pin_lookup("5005")),
        ]
        accountant = User(name="A. Reyes", initials="AR", email="a.reyes@surftec.com", role="Accountant",
                           password_hash=hash_secret("surftec-demo"))
        db.add_all([torres, accountant, *operators])
        db.flush()

        portal_user = PortalUser(name="K. Alvarez", email="k.alvarez@meridian-aero.com",
                                  password_hash=hash_secret("meridian-demo"),
                                  customer_id=customers["Meridian Aerostructures"].id)
        db.add(portal_user)

        # ----------------------------------------------------------------- vendors
        vendors = {
            "ChemSupply West": Vendor(name="ChemSupply West", category="Process chemicals", approval_basis="Survey + cert review", otd_pct=98, survey_due_at=D(2027, 3, 1), status="Approved"),
            "Pacific Finishes": Vendor(name="Pacific Finishes", category="Dyes & additives", approval_basis="Cert review", otd_pct=94, survey_due_at=D(2026, 10, 1), status="Approved"),
            "Calibrate-It Labs": Vendor(name="Calibrate-It Labs", category="Calibration (17025)", approval_basis="A2LA accreditation", otd_pct=100, survey_due_at=D(2027, 1, 1), status="Approved"),
            "NDT Supply Co.": Vendor(name="NDT Supply Co.", category="NDT consumables", approval_basis="Cert review", otd_pct=82, survey_due_at=D(2026, 6, 1), survey_overdue=True, status="Conditional"),
            "Ridgeline Waste Svcs": Vendor(name="Ridgeline Waste Svcs", category="Hazmat disposal", approval_basis="Permit + survey", otd_pct=96, survey_due_at=D(2026, 12, 1), status="Approved"),
            "Henkel (distr.)": Vendor(name="Henkel (distr.)", category="Process chemicals", approval_basis="Cert review", otd_pct=95, survey_due_at=D(2026, 12, 1), status="Approved"),
            "AeroCoat Distr.": Vendor(name="AeroCoat Distr.", category="Coatings", approval_basis="Cert review", otd_pct=95, survey_due_at=D(2026, 12, 1), status="Approved"),
        }
        db.add_all(vendors.values())
        db.flush()

        # ---------------------------------------------------------------- documents
        doc_rows = [
            ("QM-001", "Quality Manual", "M", D(2026, 2, 1), "M. Torres", "Released"),
            ("QP-830", "Control of Nonconforming Product", "F", D(2026, 4, 1), "M. Torres", "Released"),
            ("QP-750", "Record Retention & Electronic Records", "B", D(2026, 3, 1), "M. Torres", "Released"),
            ("WI-AN-014", "Sulfuric Anodize — Type II / III", "G", D(2026, 5, 1), "Processing", "Released"),
            ("WI-CF-003", "Chemical Conversion Coating", "E", D(2026, 1, 1), "Processing", "Released"),
            ("WI-PS-004", "Passivation of CRES", "D", D(2026, 6, 1), "Processing", "In Review — Rev E"),
            ("WI-RK-003", "Racking & Handling", "C", D(2025, 9, 1), "Processing", "In Review — Rev D"),
            ("WI-RC-001", "Receiving Inspection & Count", "D", D(2025, 11, 1), "Processing", "Released"),
            ("WI-CL-001", "Alkaline Degrease", "C", D(2025, 8, 1), "Processing", "Released"),
            ("WI-CL-002", "Alkaline Clean", "C", D(2025, 8, 1), "Processing", "Released"),
            ("WI-ET-001", "Caustic Etch", "B", D(2025, 10, 1), "Processing", "Released"),
            ("WI-DX-001", "Deoxidize / Desmut", "C", D(2025, 10, 1), "Processing", "Released"),
            ("WI-DY-002", "Black Dye — Anodize", "B", D(2026, 1, 1), "Processing", "Released"),
            ("WI-SL-001", "Nickel Acetate Seal", "C", D(2025, 12, 1), "Processing", "Released"),
            ("WI-UR-001", "Unrack & Dry", "A", D(2025, 6, 1), "Processing", "Released"),
            ("WI-FI-006", "Final Inspect — Coating Weight (ASTM B137)", "B", D(2026, 2, 1), "Quality", "Released"),
            ("WI-WB-001", "Water Break Test", "A", D(2025, 9, 1), "Quality", "Released"),
            ("WI-FI-002", "Final Inspect — Passivation (Copper Sulfate)", "B", D(2026, 2, 1), "Quality", "Released"),
            ("WI-FI-004", "Final Inspect — Chem Film Resistance", "B", D(2026, 2, 1), "Quality", "Released"),
            ("WI-PT-008", "Prime Application", "C", D(2026, 3, 1), "Processing", "Released"),
            ("WI-PT-009", "Cure Cycle", "B", D(2026, 3, 1), "Processing", "Released"),
            ("WI-PT-010", "Topcoat Application", "C", D(2026, 3, 1), "Processing", "Released"),
            ("WI-FI-005", "Final Inspect — Adhesion (ASTM D3359)", "B", D(2026, 2, 1), "Quality", "Released"),
            ("WI-HT-002", "Stress Relieve", "B", D(2025, 12, 1), "Processing", "Released"),
            ("WI-NP-001", "Nickel Plate", "D", D(2026, 1, 1), "Processing", "Released"),
            ("WI-HT-003", "Bake — Embrittlement Relief", "B", D(2025, 12, 1), "Processing", "Released"),
            ("WI-FI-007", "Final Inspect — Thickness XRF", "C", D(2026, 2, 1), "Quality", "Released"),
        ]
        for no, title, rev, eff, owner, status in doc_rows:
            db.add(Document(doc_no=no, title=title, revision=rev, effective_date=eff, owner=owner, status=status))
        db.flush()

        # -------------------------------------------------------------------- tanks
        tank_rows = [
            ("T-02", "Alkaline Cleaner", "Conc. (oz/gal)", "4.0 – 8.0", 4.0, 8.0, 6.2, D(2026, 7, 8), D(2026, 7, 15), False, None),
            ("T-04", "Etch — NaOH", "NaOH (oz/gal)", "6.0 – 10.0", 6.0, 10.0, 8.1, D(2026, 7, 8), D(2026, 7, 15), False, None),
            ("T-05", "Deoxidizer", "Fe (g/L)", "≤ 15.0", None, 15.0, 11.4, D(2026, 7, 7), D(2026, 7, 14), False, None),
            ("T-07", "Sulfuric Anodize", "H₂SO₄ (oz/gal)", "20 – 26", 20.0, 26.0, 24.6, D(2026, 7, 2), None, False, None),
            ("T-09", "Black Dye", "pH", "5.5 – 6.0", 5.5, 6.0, 6.3, D(2026, 7, 9), None, True, "Out of control: 6.3 vs limits 5.5 – 6.0"),
            ("T-11", "Ni-Acetate Seal", "Ni (g/L)", "5.0 – 7.0", 5.0, 7.0, 5.8, D(2026, 7, 6), D(2026, 7, 13), False, None),
            ("T-12", "Chem Film 1200S", "Cr⁶⁺ (g/L)", "3.5 – 5.5", 3.5, 5.5, 4.1, D(2026, 7, 7), D(2026, 7, 14), False, None),
            ("T-14", "Passivate — HNO₃", "HNO₃ (% v/v)", "20 – 30", 20.0, 30.0, 25.2, D(2026, 7, 8), D(2026, 7, 22), False, None),
            ("T-16", "Nickel Sulfamate", "NiSO₄ (oz/gal)", "30 – 40", 30.0, 40.0, 28.0, D(2026, 7, 9), None, True, "Out of control: 28.0 vs limits 30 – 40"),
        ]
        tanks: dict[str, Tank] = {}
        for tid, solution, param, limits_text, lmin, lmax, result, analyzed, next_due, held, reason in tank_rows:
            t = Tank(
                id=tid, solution=solution, parameter=param, limits_text=limits_text,
                limit_min=lmin, limit_max=lmax, last_result=result,
                last_analyzed_at=dt.datetime.combine(analyzed, dt.time(9, 0)),
                next_due_at=(dt.datetime.combine(next_due, dt.time(9, 0)) if next_due else dt.datetime(2026, 7, 9, 18, 0)),
                held=held, hold_reason=reason,
            )
            tanks[tid] = t
            db.add(t)
        db.flush()
        for tid, t in tanks.items():
            db.add(TankAnalysis(tank_id=tid, result=t.last_result, in_limit=not t.held, analyzed_by="R. Patel", analyzed_at=t.last_analyzed_at))
        db.add(TankAddition(tank_id="T-16", chemical="Nickel sulfamate concentrate", amount="42 lb (calculated)", added_by="D. Ochoa", added_at=dt.datetime(2026, 7, 9, 11, 0), notes="Pending chem tech confirm"))
        db.flush()

        # --------------------------------------------------------------- job data
        def mk_ops(job_id: str, rows):
            ops = []
            for i, row in enumerate(rows):
                name, params, wi, done, *rest = row
                sign = rest[0] if rest else None
                tank_id = None
                for t in tanks:
                    if f"Tank {t.split('-')[1].lstrip('0')}" in name:
                        tank_id = t
                        break
                op = JobOperation(
                    job_id=job_id, seq=(i + 1) * 10, name=name, parameters=params,
                    work_instruction_doc_no=wi, tank_id=tank_id, done=done,
                )
                if done and sign:
                    who, when = sign.split(" · ")
                    _mon, day, hm = when.split(" ")
                    hour, minute = (int(x) for x in hm.split(":"))
                    op.signed_by = who
                    op.signed_at = dt.datetime(2026, 7, int(day), hour, minute)
                ops.append(op)
            return ops

        job_specs = [
            dict(id="J-26187", customer="Meridian Aerostructures", po="PO-88214", part="MA-4471-3", rev="C",
                 qty=48, lot="L-2611", process="Anodize Type II", spec="MIL-A-8625F Ty II Cl 2",
                 spec_note="Black dye, 0.7–1.0 mil", due=D(2026, 7, 10), due_note="ships FedEx Frt", itar=True, status="In Process",
                 ops=[
                     ("Receive & Count", "Visual 100% · verify rev C", "WI-RC-001", True, "J. Kim · Jul 7 08:12"),
                     ("Rack", "Ti racks, 12/flight bar", "WI-RK-003", True, "D. Ochoa · Jul 7 09:40"),
                     ("Alkaline Clean — Tank 2", "140°F · 5 min", "WI-CL-002", True, "D. Ochoa · Jul 7 10:05"),
                     ("Etch — Tank 4", "NaOH 8 oz/gal · 2 min", "WI-ET-001", True, "D. Ochoa · Jul 7 10:18"),
                     ("Deox — Tank 5", "Smut-Go 20% · 3 min", "WI-DX-001", True, "D. Ochoa · Jul 7 10:26"),
                     ("Anodize — Tank 7", "15 ASF · 68°F · 32 min", "WI-AN-014", False),
                     ("Dye Black — Tank 9", "120°F · 15 min · pH 5.7", "WI-DY-002", False),
                     ("Seal — Tank 11", "Ni-acetate · 195°F · 20 min", "WI-SL-001", False),
                     ("Unrack & Dry", "Air dry, cotton gloves", "WI-UR-001", False),
                     ("Final Inspect", "Coating wt per ASTM B137", "WI-FI-006", False),
                 ]),
            dict(id="J-26184", customer="Falcon Dynamics", po="PO-11762", part="FD-2280-1", rev="B",
                 qty=12, lot="L-2608", process="Passivate", spec="AMS 2700E Method 1 Ty 2",
                 spec_note="Citric alternative approved", due=D(2026, 7, 9), due_note="due today", itar=False, status="Final Inspect",
                 ops=[
                     ("Receive & Count", "Visual 100%", "WI-RC-001", True, "J. Kim · Jul 8 07:55"),
                     ("Degrease — Tank 1", "130°F · 10 min", "WI-CL-001", True, "R. Patel · Jul 8 08:30"),
                     ("Passivate — Tank 14", "HNO₃ 25% · 70°F · 30 min", "WI-PS-004", True, "R. Patel · Jul 8 09:20"),
                     ("Water Break Test", "Per AMS 2700 §3.4", "WI-WB-001", True, "R. Patel · Jul 8 09:58"),
                     ("Final Inspect", "Copper sulfate verify", "WI-FI-002", False),
                 ]),
            dict(id="J-26191", customer="Vantage Gear & Actuation", po="PO-30417", part="VG-118-7", rev="A",
                 qty=200, lot="L-2614", process="Chem Film", spec="MIL-DTL-5541F Ty 1 Cl 3",
                 spec_note="Cl 3 — low resistance", due=D(2026, 7, 13), due_note="", itar=True, status="Queued",
                 ops=[
                     ("Receive & Count", "Visual 100%", "WI-RC-001", False),
                     ("Alkaline Clean — Tank 2", "140°F · 5 min", "WI-CL-002", False),
                     ("Deox — Tank 5", "Smut-Go 20% · 2 min", "WI-DX-001", False),
                     ("Chem Film — Tank 12", "Bonderite 1200S · 90 s", "WI-CF-003", False),
                     ("Final Inspect", "Resistance per MIL-DTL-81706", "WI-FI-004", False),
                 ]),
            dict(id="J-26178", customer="Meridian Aerostructures", po="PO-88102", part="MA-3902-1", rev="F",
                 qty=30, lot="L-2601", process="Prime & Paint", spec="MIL-PRF-23377K Ty I Cl C2",
                 spec_note="+ MIL-PRF-85285 topcoat", due=D(2026, 7, 11), due_note="", itar=False, status="In Process",
                 ops=[
                     ("Receive & Count", "Visual 100%", "WI-RC-001", True, "J. Kim · Jul 6 10:02"),
                     ("Chem Film — Tank 12", "Pretreat per 5541 Cl 1A", "WI-CF-003", True, "D. Ochoa · Jul 6 13:30"),
                     ("Prime", "DFT 0.6–0.9 mil · booth 2", "WI-PT-008", True, "S. Nguyen · Jul 7 11:15"),
                     ("Cure", "4 hr @ 140°F", "WI-PT-009", False),
                     ("Topcoat", "DFT 1.7–2.3 mil", "WI-PT-010", False),
                     ("Final Inspect", "Adhesion per ASTM D3359", "WI-FI-005", False),
                 ]),
            dict(id="J-26193", customer="Corvid Space Systems", po="PO-77045", part="CS-509-2", rev="D",
                 qty=8, lot="L-2616", process="Nickel Plate", spec="AMS 2403K",
                 spec_note='0.002" min thickness', due=D(2026, 7, 15), due_note="", itar=True, status="Hold — NCR",
                 ops=[
                     ("Receive & Count", "Visual 100%", "WI-RC-001", True, "J. Kim · Jul 8 14:20"),
                     ("Stress Relieve", "375°F · 3 hr", "WI-HT-002", False),
                     ("Nickel Plate — Tank 16", '40 ASF · 0.002" min', "WI-NP-001", False),
                     ("Bake — Embrittlement Relief", "375°F · 23 hr", "WI-HT-003", False),
                     ("Final Inspect", "Thickness XRF · 3 pts", "WI-FI-007", False),
                 ]),
        ]

        # Historical / already-shipped jobs referenced only by Certs & Invoicing screens.
        historical = [
            ("J-26144", "Meridian Aerostructures", "PO-88214-B", "MA-4471-1", "Anodize Type II", "MIL-A-8625F Ty II Cl 2", 48),
            ("J-26151", "Meridian Aerostructures", "PO-88220", "MA-5002-1", "Chem Film", "MIL-DTL-5541F Ty 1 Cl 3", 60),
            ("J-26160", "Falcon Dynamics", "PO-11780", "FD-2295-2", "Passivate", "AMS 2700E Method 1 Ty 2", 24),
            ("J-26155", "Vantage Gear & Actuation", "PO-30390", "VG-104-2", "Chem Film", "MIL-DTL-5541F Ty 1 Cl 3", 150),
            ("J-26158", "Vantage Gear & Actuation", "PO-30401", "VG-107-1", "Chem Film", "MIL-DTL-5541F Ty 1 Cl 3", 90),
            ("J-26149", "Corvid Space Systems", "PO-77020", "CS-488-1", "Nickel Plate", "AMS 2403K", 6),
            ("J-26162", "Meridian Aerostructures", "PO-88235", "MA-4471-2", "Anodize Type II", "MIL-A-8625F Ty II Cl 2", 36),
            ("J-26139", "Apex Rotorcraft", "PO-55190", "AR-770-1", "Anodize Type III", "MIL-A-8625F Ty III Cl 1", 20),
        ]

        jobs: dict[str, Job] = {}
        for spec in job_specs:
            job = Job(
                id=spec["id"], customer_id=customers[spec["customer"]].id, customer_po=spec["po"],
                part_number=spec["part"], revision=spec["rev"], qty=spec["qty"], material_lot=spec["lot"],
                process_label=spec["process"], spec=spec["spec"], spec_note=spec["spec_note"],
                due_date=spec["due"], due_note=spec["due_note"], itar=spec["itar"], status=spec["status"],
            )
            db.add(job)
            db.flush()
            for op in mk_ops(spec["id"], spec["ops"]):
                db.add(op)
            jobs[spec["id"]] = job
        db.flush()

        for jid, customer_name, po, part, process, spec_txt, qty in historical:
            job = Job(
                id=jid, customer_id=customers[customer_name].id, customer_po=po, part_number=part,
                revision="A", qty=qty, material_lot=f"L-{jid[-4:]}", process_label=process, spec=spec_txt,
                spec_note="", due_date=D(2026, 7, 6), due_note="", itar=False, status="Complete",
            )
            db.add(job)
            db.flush()
            db.add(JobOperation(job_id=jid, seq=10, name="Receive & Count", parameters="Visual 100%", work_instruction_doc_no="WI-RC-001", done=True, signed_by="J. Kim", signed_at=dt.datetime(2026, 7, 3, 8, 0)))
            db.add(JobOperation(job_id=jid, seq=20, name=process, parameters="Per spec", done=True, signed_by="D. Ochoa", signed_at=dt.datetime(2026, 7, 4, 10, 0)))
            db.add(JobOperation(job_id=jid, seq=30, name="Final Inspect", parameters="Per spec", done=True, signed_by="M. Torres", signed_at=dt.datetime(2026, 7, 5, 14, 0)))
            jobs[jid] = job
        db.flush()

        # ---------------------------------------------------------------- spec results
        # In-process spec checks with pass/fail. J-26184 carries an unresolved FAIL
        # (water break) — it demos the ship-block rule even once all ops are signed.
        spec_results = [
            SpecResult(job_id="J-26187", param_key="clean-temp", name="Alkaline Clean Temp", requirement="135–145 °F",
                       value_text="141 °F", passed=True, recorded_by="D. Ochoa", recorded_at=dt.datetime(2026, 7, 7, 10, 4)),
            SpecResult(job_id="J-26187", param_key="etch-time", name="Etch Time", requirement="1.5–2.5 min",
                       value_text="2.0 min", passed=True, recorded_by="D. Ochoa", recorded_at=dt.datetime(2026, 7, 7, 10, 17)),
            SpecResult(job_id="J-26184", param_key="passivate-time", name="Passivation Immersion Time", requirement="25–35 min",
                       value_text="30 min", passed=True, recorded_by="R. Patel", recorded_at=dt.datetime(2026, 7, 8, 9, 19)),
            SpecResult(job_id="J-26184", param_key="water-break", name="Water Break Test", requirement="No break — continuous film",
                       value_text="Beading observed on 2 of 12 pcs", passed=False, recorded_by="R. Patel",
                       recorded_at=dt.datetime(2026, 7, 8, 9, 58)),
            SpecResult(job_id="J-26144", param_key="coating-wt", name="Coating Weight (ASTM B137)", requirement="≥ 1000 mg/ft²",
                       value_text="1180 mg/ft²", passed=True, recorded_by="M. Torres", recorded_at=dt.datetime(2026, 7, 5, 13, 45)),
        ]
        for sr in spec_results:
            db.add(sr)
        db.flush()

        # ------------------------------------------------------------------- orders
        order_rows = [
            ("SO-26-0412", "order", "Meridian Aerostructures", "PO-88214", "MA-4471-3", "MIL-A-8625 T2 C2", 48, 3840, D(2026, 7, 10), "In Process", "J-26187"),
            ("SO-26-0415", "order", "Falcon Dynamics", "PO-11762", "FD-2280-1", "AMS 2700 M1", 12, 1260, D(2026, 7, 9), "Inspecting", "J-26184"),
            ("SO-26-0418", "order", "Vantage Gear & Actuation", "PO-30417", "VG-118-7", "MIL-DTL-5541 T1 C3", 200, 5400, D(2026, 7, 13), "Queued", "J-26191"),
            ("SO-26-0419", "order", "Corvid Space Systems", "PO-77045", "CS-509-2", "AMS 2403", 8, 4675, D(2026, 7, 15), "Hold — NCR", "J-26193"),
            ("SO-26-0421", "order", "Apex Rotorcraft", "PO-55210", "AR-771-4", "MIL-A-8625 T3", 64, 7040, D(2026, 7, 17), "Queued", None),
            ("QT-26-0188", "quote", "Meridian Aerostructures", "RFQ-2231", "MA-5120-1", "MIL-PRF-23377", 120, 9600, None, "Quote — Sent", None),
            ("QT-26-0189", "quote", "Halstead Defense", "RFQ-0092", "HD-330-2", "AMS 2471", 40, 2980, None, "Quote — Draft", None),
            ("QT-26-0190", "quote", "Corvid Space Systems", "RFQ-7718", "CS-612-1", "AMS 2404", 16, 6120, None, "Quote — Review", None),
        ]
        for oid, kind, customer_name, po, part, spec_txt, qty, value, due, status, job_id in order_rows:
            db.add(Order(id=oid, kind=kind, customer_id=customers[customer_name].id, customer_po=po,
                          part_number=part, spec=spec_txt, qty=qty, value=value, due_date=due, status=status,
                          converted_job_id=job_id))
        db.flush()

        # ---------------------------------------------------------------------- ncrs
        db.add(NCR(id="NCR-26-031", job_id="J-26193", reference_label="J-26193", opened_at=D(2026, 7, 8), disposition="Open — MRB",
                    description="Pitting observed on 2 of 8 pcs after stress relieve. Customer notified; awaiting use-as-is / rework disposition."))
        db.add(NCR(id="NCR-26-030", job_id=None, reference_label="J-26170", opened_at=D(2026, 7, 3), disposition="Rework",
                    description="Chem film coating rub-off on masked edge, 6 pcs. Strip & reprocess authorized per WI-CF-003 §8."))
        db.add(NCR(id="NCR-26-029", job_id=None, tank_id="T-09", reference_label="T-09", opened_at=D(2026, 7, 1), disposition="Process NCR",
                    description="Dye tank pH drift beyond control limit between weekly analyses. Interim: analysis frequency doubled."))
        db.add(NCR(id="NCR-26-028", job_id=None, reference_label="J-26158", opened_at=D(2026, 6, 26), disposition="Closed",
                    description="One part short on incoming count vs packing slip. Customer confirmed short-ship; count corrected."))
        db.flush()

        # -------------------------------------------------------------------- capas
        db.add(CAPA(id="CAPA-26-07", ncr_id="NCR-26-029", description="Dye tank pH drift — root cause: seal tank drag-in. Add DI rinse + weekly→2× analysis.", due_date=D(2026, 7, 18), phase="Verify"))
        db.add(CAPA(id="CAPA-26-06", ncr_id="NCR-26-030", description="Racking damage on thin-wall parts — new rack design + operator training WI-RK-003 Rev D.", due_date=D(2026, 7, 11), phase="Implement"))
        db.add(CAPA(id="CAPA-26-05", ncr_id="NCR-26-028", description="Late supplier cert docs — vendor scorecard gate added at receiving.", due_date=D(2026, 6, 30), closed_date=D(2026, 6, 30), phase="Closed"))
        db.flush()

        # ------------------------------------------------------------- audit programs
        db.add(AuditProgram(name="Nadcap CP (AC7108) — Nov 2026", pct_complete=87, note="4 checklist items open: 2 chemistry records, 2 training matrix gaps.", scheduled_for=D(2026, 11, 1)))
        db.add(AuditProgram(name="AS9100D surveillance — Sep 2026", pct_complete=92, note="Internal audit complete; 1 minor finding in doc control closing this week.", scheduled_for=D(2026, 9, 1)))
        db.add(AuditProgram(name="Internal audit plan 2026", pct_complete=58, note="7 of 12 process audits complete. Plating audit scheduled Jul 21.", scheduled_for=D(2026, 7, 21)))
        db.add(AuditProgram(name="Training & certification matrix", pct_complete=81, note="3 operators due for periodic vision exam (Jul).", scheduled_for=None))
        db.flush()

        db.add_all([
            CompanyMetric(key="otd", label="On-time delivery (90 d)", value="96.4%", kind="good"),
            CompanyMetric(key="fpy", label="First-pass yield (90 d)", value="98.9%", kind="good"),
            CompanyMetric(key="escapes", label="Escapes (12 mo)", value="0", kind="good"),
            CompanyMetric(key="nadcap", label="Nadcap CP audit", value="Nov 2026", kind="neutral"),
            CompanyMetric(key="as9100", label="AS9100D surveillance", value="Sep 2026", kind="neutral"),
        ])
        db.flush()

        # --------------------------------------------------------------- certificates
        db.add(Certificate(id="CERT-26-0891", job_id="J-26144", qty_accepted=48, process_text="Anodize, Sulfuric — MIL-A-8625F Type II Class 2, Black",
                            issued=True, issued_at=dt.datetime(2026, 7, 8, 14, 2), issued_by="M. Torres"))
        db.flush()

        # ------------------------------------------------------------------ invoices
        invoice_rows = [
            ("INV-26-1042", "Meridian Aerostructures", ["J-26144", "J-26151"], 8420, "Net 30", "Sent", "Synced"),
            ("INV-26-1043", "Falcon Dynamics", ["J-26160"], 2150, "Net 30", "Paid", "Synced"),
            ("INV-26-1044", "Vantage Gear & Actuation", ["J-26155", "J-26158"], 11930, "Net 45", "Sent", "Pending"),
            ("INV-26-1045", "Corvid Space Systems", ["J-26149"], 4675, "Net 30", "Draft", "Not synced"),
            ("INV-26-1046", "Meridian Aerostructures", ["J-26162"], 3310, "Net 30", "Sent", "Pending"),
            ("INV-26-1047", "Apex Rotorcraft", ["J-26139"], 1980, "Net 30", "Overdue", "Synced"),
        ]
        for inv_id, customer_name, job_ids, amount, terms, status, qb in invoice_rows:
            inv = Invoice(id=inv_id, customer_id=customers[customer_name].id, amount=amount, terms=terms,
                           status=status, qb_sync_status=qb,
                           last_synced_at=(dt.datetime(2026, 7, 9, 13, 47) if qb == "Synced" else None),
                           quickbooks_invoice_id=(f"QBO-{inv_id}" if qb == "Synced" else None))
            db.add(inv)
            db.flush()
            per_job = round(float(amount) / len(job_ids), 2)
            for jid in job_ids:
                db.add(InvoiceLine(invoice_id=inv_id, job_id=jid, amount=per_job))
        db.flush()

        # --------------------------------------------------------------------- equipment
        equipment_rows = [
            ("CAL-014", "Coating thickness gauge (XRF)", "Final Inspect", "12 mo", 12, D(2025, 8, 1), D(2026, 8, 1)),
            ("CAL-022", "Tank 7 temp controller", "Anodize line", "6 mo", 6, D(2026, 1, 1), D(2026, 7, 12)),
            ("CAL-031", "pH meter — lab", "Chem lab", "3 mo", 3, D(2026, 3, 1), D(2026, 6, 28)),
            ("CAL-008", "DC rectifier #2 shunt", "Anodize line", "12 mo", 12, D(2026, 2, 1), D(2027, 2, 1)),
            ("CAL-040", "Oven — embrittlement bake", "Heat treat", "3 mo", 3, D(2026, 4, 1), D(2026, 7, 2)),
            ("CAL-017", "Micrometer set (0–1\")", "Receiving", "12 mo", 12, D(2025, 11, 1), D(2026, 11, 1)),
            ("CAL-025", "Conductivity meter — DI water", "Rinse line", "6 mo", 6, D(2026, 5, 1), D(2026, 11, 1)),
        ]
        equipment: dict[str, Equipment] = {}
        for asset, name, location, interval_text, interval_months, last, due in equipment_rows:
            eq = Equipment(id=asset, name=name, location=location, interval_text=interval_text,
                            interval_months=interval_months, last_calibrated_at=last, due_at=due)
            db.add(eq)
            equipment[asset] = eq
        db.flush()
        for asset, eq in equipment.items():
            db.add(CalibrationRecord(equipment_id=asset, performed_at=dt.datetime.combine(eq.last_calibrated_at, dt.time(9, 0)), performed_by="Calibrate-It Labs", result="Pass", next_due_at=eq.due_at))
        db.flush()

        # Wire equipment onto ops: overdue oven blocks the embrittlement bake step (demonstrates the rule).
        bake_op = db.query(JobOperation).filter_by(job_id="J-26193", name="Bake — Embrittlement Relief").one()
        bake_op.equipment_id = "CAL-040"
        for jid, op_name in [("J-26187", "Final Inspect"), ("J-26193", "Final Inspect")]:
            op = db.query(JobOperation).filter_by(job_id=jid, name=op_name).one()
            op.equipment_id = "CAL-014"
        db.flush()

        # -------------------------------------------------------------------- inventory
        inventory_rows = [
            ("Sulfuric acid 66°Bé", "SA-26-118", "ChemSupply West", 340, "gal", 150, None),
            ("Nickel acetate seal salt", "NA-26-044", "ChemSupply West", 18, "kg", 25, D(2027, 3, 1)),
            ("Bonderite 1200S", "BD-26-071", "Henkel (distr.)", 96, "kg", 40, D(2027, 1, 1)),
            ("Black dye — Sanodal", "DY-25-203", "Pacific Finishes", 11, "kg", 8, D(2026, 8, 1)),
            ("Nitric acid 42°Bé", "NI-26-095", "ChemSupply West", 210, "gal", 100, None),
            ("MIL-PRF-23377 primer", "PR-26-031", "AeroCoat Distr.", 9, "kits", 6, D(2026, 10, 1)),
            ("Penetrant developer D-100", "PD-25-188", "NDT Supply Co.", 2, "cs", 4, D(2026, 7, 1)),
        ]
        for name, lot, vendor_name, on_hand, unit, reorder, expires in inventory_rows:
            db.add(InventoryLot(chemical_name=name, lot_number=lot, vendor_id=vendors[vendor_name].id,
                                 on_hand_qty=on_hand, on_hand_unit=unit, reorder_at_qty=reorder, expires_at=expires))
        db.flush()

        db.commit()
        print("Seed complete.")
        print(f"  users: login as m.torres@surftec.com / surftec-demo  (Quality Manager)")
        print(f"  shop-floor PINs: Torres=1001  J.Kim=2002  D.Ochoa=3003  R.Patel=4004  S.Nguyen=5005")
        print(f"  portal login: k.alvarez@meridian-aero.com / meridian-demo")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
