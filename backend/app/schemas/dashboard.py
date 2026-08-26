from app.schemas.common import ORMModel


class Kpi(ORMModel):
    key: str
    value: str
    label: str
    kind: str  # good | warn | bad | info | neutral


class HotJob(ORMModel):
    id: str
    customer: str
    process: str
    current_op: str
    due: str
    due_urgent: bool


class TankAlert(ORMModel):
    tank_id: str
    title: str
    detail: str
    kind: str  # bad | warn


class PulseItem(ORMModel):
    label: str
    value: str
    kind: str


class DashboardSummary(ORMModel):
    kpis: list[Kpi]
    hot_jobs: list[HotJob]
    tank_alerts: list[TankAlert]
    pulse: list[PulseItem]
