from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Texas Precision Plating ERP API"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://surftec:surftec_dev_pw@localhost:5432/surftec_erp"

    secret_key: str = "dev-only-secret-change-me"
    access_token_expire_minutes: int = 60 * 12
    algorithm: str = "HS256"

    # Comma-separated list, e.g. "http://1.2.3.4:5173,http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    company_name: str = "TEXAS PRECISION PLATING"
    itar_banner_default: bool = True
    accent_color_default: str = "#34698C"

    # OAuth2 client-credentials grant for machine-to-machine API clients (see /docs "API & Integrations").
    api_client_id: str = "surftec-integration"
    api_client_secret: str = "dev-only-integration-secret"

    # Anthropic (Claude) — powers AI drawing analysis. Set ANTHROPIC_API_KEY to enable.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # QuickBooks Online (Intuit) OAuth2 — populate to enable live sync.
    qbo_client_id: str = ""
    qbo_client_secret: str = ""
    qbo_environment: str = "sandbox"  # sandbox | production
    qbo_redirect_uri: str = "http://localhost:8000/api/v1/quickbooks/callback"

    @property
    def qbo_configured(self) -> bool:
        return bool(self.qbo_client_id and self.qbo_client_secret)

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    # Email intake — polls an IMAP inbox for unread messages, scans PDF attachments from
    # allowlisted senders through the same AI Drawing Scan used for manual uploads. Gmail
    # requires an App Password (Google Account → Security → App Passwords), not your login password.
    imap_host: str = ""
    imap_port: int = 993
    imap_username: str = ""
    imap_password: str = ""
    imap_folder: str = "INBOX"
    # Comma-separated senders/domains, e.g. "estimating@customer.com,@trustedcustomer.com"
    imap_allowed_senders: str = ""
    imap_poll_interval_minutes: int = 5

    @property
    def email_intake_configured(self) -> bool:
        return bool(self.imap_host and self.imap_username and self.imap_password)

    @property
    def imap_allowed_sender_list(self) -> list[str]:
        return [s.strip().lower() for s in self.imap_allowed_senders.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
