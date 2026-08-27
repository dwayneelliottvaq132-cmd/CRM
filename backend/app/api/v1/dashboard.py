import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.chemistry import Tank
from app.models.compliance import CompanyMetric, NCR
from app.models.equipment import Equipment
from app.models.job import Job
from app.schemas.dashboard import DashboardSummary, HotJob, Kpi, PulseItem, TankAlert

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])

OPEN_JOB_STATUSES = ("Queued", "In Process", "Final Inspect", "Hold — NCR")
OPEN_NCR_DISPOSITIONS = ("Open — MRB", "Rework", "Process NCR")


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)) -> DashboardSummary:
    now = dt.datetime.now(dt.timezone.utc)
    soon = now + dt.timedelta(hours=48)

    def _due_dt(d: dt.date) -> dt.datetime:
        return dt.datetime.combine(d, dt.time(), tzinfo=dt.timezone.utc)

    jobs = db.execute(
        select(Job).options(selectinload(Job.customer), selectinload(Job.ops)).where(Job.status.in_(OPEN_JOB_STATUSES))
    ).scalars().all()

    due_soon = [j for j in jobs if j.due_date and _due_dt(j.due_date) <= soon]
    open_ncrs = db.execute(select(func.count()).select_from(NCR).where(NCR.disposition.in_(OPEN_NCR_DISPOSITIONS))).scalar_one()
    tanks_ooc = db.execute(select(func.count()).select_from(Tank).where(Tank.held.is_(True))).scalar_one()
    equipment_list = db.execute(select(Equipment)).scalars().all()
    overdue_equipment = [e for e in equipment_list if e.is_overdue()]
    # The "Unsynced invoices" KPI was QuickBooks-derived (it summed invoices whose
    # qb_sync_status was not "Synced"), so it goes with the rest of the hidden QBO UI.
    # Invoice.qb_sync_status itself is untouched; restoring the tile is re-adding the row.
    kpis = [
        Kpi(key="wip", value=str(len(jobs)), label="Jobs in WIP", kind="info"),
        Kpi(key="due48", value=str(len(due_soon)), label="Due within 48 hrs", kind="warn" if due_soon else "good"),
        Kpi(key="ncrs", value=str(open_ncrs), label="Open NCRs", kind="bad" if open_ncrs else "good"),
        Kpi(key="tanks_ooc", value=str(tanks_ooc), label="Tanks out of control", kind="bad" if tanks_ooc else "good"),
        Kpi(key="cal_overdue", value=str(len(overdue_equipment)), label="Calibrations overdue", kind="warn" if overdue_equipment else "good"),
    ]

    hot = sorted(
        [j for j in jobs if (j.due_date and _due_dt(j.due_date) <= soon) or j.status == "Hold — NCR"],
        key=lambda j: (j.due_date is None, j.due_date),
    )[:5]
    hot_jobs = []
    for j in hot:
        cur = j.current_op()
        hot_jobs.append(HotJob(
            id=j.id, customer=j.customer.name, process=j.process_label,
            current_op=("⚠ On hold — NCR" if j.status == "Hold — NCR" else (cur.name if cur else "Ship")),
            due=j.due_date.strftime("%b %-d") if j.due_date else "—",
            due_urgent=bool(j.due_date and _due_dt(j.due_date) <= soon),
        ))

    tanks = db.execute(select(Tank)).scalars().all()
    tank_alerts: list[TankAlert] = []
    for t in tanks:
        if t.held:
            tank_alerts.append(TankAlert(tank_id=t.id, title=f"{t.id} — {t.solution} out of control", detail=f"Last result {t.last_result} vs limit {t.limits_text}. {t.hold_reason or ''}", kind="bad"))
        elif t.next_due_at and t.next_due_at <= now + dt.timedelta(hours=8):
            tank_alerts.append(TankAlert(tank_id=t.id, title=f"{t.id} — analysis due soon", detail=f"{t.solution} · next analysis due {t.next_due_at.strftime('%b %-d %H:%M')}", kind="warn"))

    metrics = db.execute(select(CompanyMetric)).scalars().all()
    pulse = [PulseItem(label=m.label, value=m.value, kind=m.kind) for m in metrics]

    return DashboardSummary(kpis=kpis, hot_jobs=hot_jobs, tank_alerts=tank_alerts[:3], pulse=pulse)
