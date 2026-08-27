"""Thin wrapper around Intuit's OAuth2 + QuickBooks Online REST API.

Real end-to-end sync requires a QuickBooks Developer app (client id/secret) —
set QBO_CLIENT_ID / QBO_CLIENT_SECRET (see backend/.env.example). Until those
are configured, `Settings.qbo_configured` is False and the service layer
(app/services/quickbooks_service.py) simulates a successful sync instead of
calling out to Intuit, so the rest of the app can be built/demoed without
live credentials.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from app.core.config import get_settings

settings = get_settings()


@dataclass
class QBTokens:
    access_token: str
    refresh_token: str
    realm_id: str
    access_token_expires_at: dt.datetime
    refresh_token_expires_at: dt.datetime


def _auth_client():
    from intuitlib.client import AuthClient  # imported lazily — optional dependency at runtime

    return AuthClient(
        client_id=settings.qbo_client_id,
        client_secret=settings.qbo_client_secret,
        environment=settings.qbo_environment,
        redirect_uri=settings.qbo_redirect_uri,
    )


def get_authorization_url() -> str:
    from intuitlib.enums import Scopes

    client = _auth_client()
    return client.get_authorization_url([Scopes.ACCOUNTING])


def exchange_code_for_tokens(auth_code: str, realm_id: str) -> QBTokens:
    client = _auth_client()
    client.get_bearer_token(auth_code, realm_id=realm_id)
    now = dt.datetime.utcnow()
    return QBTokens(
        access_token=client.access_token,
        refresh_token=client.refresh_token,
        realm_id=realm_id,
        access_token_expires_at=now + dt.timedelta(seconds=client.expires_in or 3600),
        refresh_token_expires_at=now + dt.timedelta(days=100),
    )


def _qb_client(connection):
    from quickbooks import QuickBooks

    return QuickBooks(
        sandbox=settings.qbo_environment == "sandbox",
        consumer_key=settings.qbo_client_id,
        consumer_secret=settings.qbo_client_secret,
        access_token=connection.access_token,
        refresh_token=connection.refresh_token,
        company_id=connection.realm_id,
    )


def push_invoice(connection, *, customer_name: str, invoice_number: str, amount: float, memo: str) -> str:
    """Creates (or updates) an Invoice in QuickBooks Online. Returns the QBO invoice Id.
    Only called when settings.qbo_configured is True and a live connection exists."""
    from quickbooks.objects.customer import Customer as QBCustomer
    from quickbooks.objects.invoice import Invoice as QBInvoice
    from quickbooks.objects.detailline import SalesItemLine, SalesItemLineDetail

    client = _qb_client(connection)

    customers = QBCustomer.filter(DisplayName=customer_name, qb=client)
    if customers:
        qb_customer = customers[0]
    else:
        qb_customer = QBCustomer()
        qb_customer.DisplayName = customer_name
        qb_customer.save(qb=client)

    line = SalesItemLine()
    line.Amount = amount
    line.Description = memo
    line.SalesItemLineDetail = SalesItemLineDetail()

    invoice = QBInvoice()
    invoice.DocNumber = invoice_number
    invoice.CustomerRef = qb_customer.to_ref()
    invoice.Line = [line]
    invoice.save(qb=client)
    return str(invoice.Id)
