from app.db.base_class import Base

# Import all models here so Alembic autogenerate / Base.metadata.create_all sees them.
from app.models.user import User, PortalUser  # noqa: E402,F401
from app.models.customer import Customer, Vendor  # noqa: E402,F401
from app.models.order import Order, OrderLine  # noqa: E402,F401
from app.models.contract_review import ContractReview  # noqa: E402,F401
from app.models.job import Job, JobOperation, SpecResult  # noqa: E402,F401
from app.models.routing import RoutingTemplate, Part, RoutingRevision, RoutingStep  # noqa: E402,F401
from app.models.drawing import DrawingAnalysis  # noqa: E402,F401
from app.models.purchase_order import PurchaseOrderAnalysis  # noqa: E402,F401
from app.models.chemistry import Tank, TankAnalysis, TankAddition  # noqa: E402,F401
from app.models.compliance import NCR, CAPA, AuditProgram, CompanyMetric  # noqa: E402,F401
from app.models.certificate import Certificate  # noqa: E402,F401
from app.models.invoice import Invoice, InvoiceLine  # noqa: E402,F401
from app.models.equipment import Equipment, CalibrationRecord  # noqa: E402,F401
from app.models.inventory import InventoryLot  # noqa: E402,F401
from app.models.document import Document  # noqa: E402,F401
from app.models.audit_log import AuditLogEntry  # noqa: E402,F401
from app.models.webhook import WebhookEvent  # noqa: E402,F401
from app.models.attachment import Attachment  # noqa: E402,F401
from app.models.integration import QuickBooksConnection, EmailIntakeState, EmailIntakeLog  # noqa: E402,F401

__all__ = ["Base"]
from app.models.rate import FinishRate  # noqa: E402,F401
