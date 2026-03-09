from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from .models import AuthTypeEnum, CampaignStatusEnum, LogStatusEnum, ProviderEnum


# ── Domain ──────────────────────────────────────────────────────────────────

class DomainEmailCreate(BaseModel):
    email: str
    password: Optional[str] = None
    smtp_host: str
    smtp_port: int = 587
    imap_host: str
    imap_port: int = 993
    auth_type: AuthTypeEnum = AuthTypeEnum.password


class DomainEmailOut(DomainEmailCreate):
    id: int
    domain_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DomainCreate(BaseModel):
    name: str


class DomainOut(DomainCreate):
    id: int
    created_at: datetime
    emails: List[DomainEmailOut] = []
    model_config = ConfigDict(from_attributes=True)


# ── Warming Account ──────────────────────────────────────────────────────────

class WarmingAccountCreate(BaseModel):
    email: str
    password: Optional[str] = None
    provider: ProviderEnum
    auth_type: AuthTypeEnum = AuthTypeEnum.password
    oauth2_access_token: Optional[str] = None
    oauth2_refresh_token: Optional[str] = None
    oauth2_client_id: Optional[str] = None
    oauth2_client_secret: Optional[str] = None
    oauth2_token_expiry: Optional[datetime] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    active: bool = True


class WarmingAccountOut(BaseModel):
    id: int
    email: str
    provider: ProviderEnum
    auth_type: AuthTypeEnum
    smtp_host: str
    smtp_port: int
    imap_host: str
    imap_port: int
    active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WarmingAccountUpdate(BaseModel):
    password: Optional[str] = None
    auth_type: Optional[AuthTypeEnum] = None
    oauth2_access_token: Optional[str] = None
    oauth2_refresh_token: Optional[str] = None
    oauth2_client_id: Optional[str] = None
    oauth2_client_secret: Optional[str] = None
    oauth2_token_expiry: Optional[datetime] = None
    active: Optional[bool] = None


# ── Campaign ─────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    emails_per_day_start: int = 5
    emails_per_day_max: int = 50
    ramp_up_days: int = 30


class CampaignOut(CampaignCreate):
    id: int
    status: CampaignStatusEnum
    current_day: int
    start_date: Optional[datetime]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Log ──────────────────────────────────────────────────────────────────────

class WarmingLogOut(BaseModel):
    id: int
    campaign_id: int
    warming_account_id: int
    domain_email_id: int
    subject: Optional[str]
    message_id: Optional[str]
    sent_at: Optional[datetime]
    received_at: Optional[datetime]
    opened_at: Optional[datetime]
    replied_at: Optional[datetime]
    status: LogStatusEnum
    error_message: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_domains: int
    total_domain_emails: int
    total_warming_accounts: int
    active_campaigns: int
    emails_sent_today: int
    emails_opened_today: int
    emails_replied_today: int
    open_rate: float
    reply_rate: float


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str
