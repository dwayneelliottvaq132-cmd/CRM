from fastapi import APIRouter, Form, HTTPException, status

from app.core.config import get_settings
from app.core.security import create_access_token
from app.schemas.auth import Token

router = APIRouter(prefix="/oauth", tags=["oauth"])
settings = get_settings()


@router.post("/token", response_model=Token)
def client_credentials_token(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
) -> Token:
    """OAuth2 client-credentials grant for machine clients (integrations, scripts).
    Matches the auth model documented on the API & Integrations screen."""
    if grant_type != "client_credentials":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported grant_type")
    if client_id != settings.api_client_id or client_secret != settings.api_client_secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid client credentials")
    token = create_access_token(subject="api-client", extra_claims={"scope": "service"})
    return Token(access_token=token)
