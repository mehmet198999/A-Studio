import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class ProviderEnum(str, enum.Enum):
    outlook = "outlook"
    gmail = "gmail"
    firstmail = "firstmail"
    custom = "custom"


class AuthTypeEnum(str, enum.Enum):
    password = "password"
    oauth2 = "oauth2"
    app_password = "app_password"


class CampaignStatusEnum(str, enum.Enum):
    active = "active"
    paused = "paused"
    stopped = "stopped"


class LogStatusEnum(str, enum.Enum):
    sent = "sent"
    received = "received"
    opened = "opened"
    replied = "replied"
    error = "error"


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    emails = relationship("DomainEmail", back_populates="domain", cascade="all, delete-orphan")


class DomainEmail(Base):
    __tablename__ = "domain_emails"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=True)
    smtp_host = Column(String, nullable=False)
    smtp_port = Column(Integer, default=587)
    imap_host = Column(String, nullable=False)
    imap_port = Column(Integer, default=993)
    auth_type = Column(Enum(AuthTypeEnum), default=AuthTypeEnum.password)
    created_at = Column(DateTime, default=datetime.utcnow)

    domain = relationship("Domain", back_populates="emails")
    logs = relationship("WarmingLog", back_populates="domain_email", cascade="all, delete-orphan")


class WarmingAccount(Base):
    __tablename__ = "warming_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=True)
    provider = Column(Enum(ProviderEnum), nullable=False)
    auth_type = Column(Enum(AuthTypeEnum), default=AuthTypeEnum.password)

    # OAuth2 fields
    oauth2_access_token = Column(Text, nullable=True)
    oauth2_refresh_token = Column(Text, nullable=True)
    oauth2_client_id = Column(String, nullable=True)
    oauth2_client_secret = Column(String, nullable=True)
    oauth2_token_expiry = Column(DateTime, nullable=True)

    # Custom SMTP/IMAP (auto-filled for known providers)
    smtp_host = Column(String, nullable=False)
    smtp_port = Column(Integer, default=587)
    imap_host = Column(String, nullable=False)
    imap_port = Column(Integer, default=993)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    logs = relationship("WarmingLog", back_populates="warming_account", cascade="all, delete-orphan")


class WarmingCampaign(Base):
    __tablename__ = "warming_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    status = Column(Enum(CampaignStatusEnum), default=CampaignStatusEnum.stopped)
    emails_per_day_start = Column(Integer, default=5)
    emails_per_day_max = Column(Integer, default=50)
    ramp_up_days = Column(Integer, default=30)
    current_day = Column(Integer, default=0)
    start_delay_days = Column(Integer, default=0)  # Wait X days before first send
    start_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    logs = relationship("WarmingLog", back_populates="campaign", cascade="all, delete-orphan")


class WarmingLog(Base):
    __tablename__ = "warming_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("warming_campaigns.id"), nullable=False)
    warming_account_id = Column(Integer, ForeignKey("warming_accounts.id"), nullable=False)
    domain_email_id = Column(Integer, ForeignKey("domain_emails.id"), nullable=False)
    subject = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    status = Column(Enum(LogStatusEnum), default=LogStatusEnum.sent)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("WarmingCampaign", back_populates="logs")
    warming_account = relationship("WarmingAccount", back_populates="logs")
    domain_email = relationship("DomainEmail", back_populates="logs")
