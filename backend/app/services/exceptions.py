class BusinessRuleError(Exception):
    """Raised when a workflow rule blocks an action (tank hold, overdue cal, unsigned ops...).
    Routers translate this into an HTTP 409 with the message as detail."""


class NotFoundError(Exception):
    """Raised when a referenced entity does not exist."""
