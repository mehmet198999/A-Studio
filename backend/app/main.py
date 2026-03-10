import csv
import io
import os
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .email_service import PROVIDER_SETTINGS, test_connection
from .oauth2_service import detect_provider, get_outlook_token_ropc
from .models import (
    AuthTypeEnum,
    CampaignStatusEnum,
    Domain,
    DomainEmail,
    LogStatusEnum,
    ProviderEnum,
    WarmingAccount,
    WarmingCampaign,
    WarmingLog,
)
from .reputation_service import check_domain_reputation
from .schemas import (
    CampaignCreate,
    CampaignOut,
    DailyStatPoint,
    DashboardStats,
    DomainCreate,
    DomainEmailCreate,
    DomainEmailOut,
    DomainOut,
    DomainReputation,
    LoginRequest,
    WarmingAccountCreate,
    WarmingAccountOut,
    WarmingAccountUpdate,
    WarmingLogOut,
)

Base.metadata.create_all(bind=engine)

AUTH_TOKEN = os.environ.get("AUTH_TOKEN", "secret-token")
app = FastAPI(title="Domain Warming API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_token(authorization: Optional[str] = Header(default=None)) -> None:
    if authorization != f"Bearer {AUTH_TOKEN}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/token")
async def login(data: LoginRequest) -> dict:
    if data.username == "admin" and data.password == os.environ.get("ADMIN_PASSWORD", "admin123"):
        return {"access_token": AUTH_TOKEN}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# ── Domains ───────────────────────────────────────────────────────────────────

@app.get("/domains", response_model=List[DomainOut], dependencies=[Depends(verify_token)])
def list_domains(db: Session = Depends(get_db)):
    return db.query(Domain).all()


@app.post("/domains", response_model=DomainOut, dependencies=[Depends(verify_token)])
def create_domain(data: DomainCreate, db: Session = Depends(get_db)):
    existing = db.query(Domain).filter(Domain.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Domain already exists")
    domain = Domain(name=data.name)
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@app.get("/domains/{domain_id}", response_model=DomainOut, dependencies=[Depends(verify_token)])
def get_domain(domain_id: int, db: Session = Depends(get_db)):
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@app.delete("/domains/{domain_id}", dependencies=[Depends(verify_token)])
def delete_domain(domain_id: int, db: Session = Depends(get_db)):
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    db.delete(domain)
    db.commit()
    return {"status": "deleted"}


# ── Domain Emails ─────────────────────────────────────────────────────────────

@app.get("/domains/{domain_id}/emails", response_model=List[DomainEmailOut], dependencies=[Depends(verify_token)])
def list_domain_emails(domain_id: int, db: Session = Depends(get_db)):
    return db.query(DomainEmail).filter(DomainEmail.domain_id == domain_id).all()


@app.post("/domains/{domain_id}/emails", response_model=DomainEmailOut, dependencies=[Depends(verify_token)])
def create_domain_email(domain_id: int, data: DomainEmailCreate, db: Session = Depends(get_db)):
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    existing = db.query(DomainEmail).filter(DomainEmail.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    de = DomainEmail(domain_id=domain_id, **data.model_dump())
    db.add(de)
    db.commit()
    db.refresh(de)
    return de


@app.delete("/domains/{domain_id}/emails/{email_id}", dependencies=[Depends(verify_token)])
def delete_domain_email(domain_id: int, email_id: int, db: Session = Depends(get_db)):
    de = db.get(DomainEmail, email_id)
    if not de or de.domain_id != domain_id:
        raise HTTPException(status_code=404, detail="Email not found")
    db.delete(de)
    db.commit()
    return {"status": "deleted"}


# ── Warming Accounts ──────────────────────────────────────────────────────────

def _apply_provider_defaults(data: WarmingAccountCreate) -> WarmingAccountCreate:
    """Fill SMTP/IMAP settings from provider defaults if not provided."""
    defaults = PROVIDER_SETTINGS.get(data.provider, {})
    if not data.smtp_host:
        data.smtp_host = defaults.get("smtp_host", "")
    if not data.smtp_port:
        data.smtp_port = defaults.get("smtp_port", 587)
    if not data.imap_host:
        data.imap_host = defaults.get("imap_host", "")
    if not data.imap_port:
        data.imap_port = defaults.get("imap_port", 993)
    return data


@app.get("/accounts", response_model=List[WarmingAccountOut], dependencies=[Depends(verify_token)])
def list_accounts(
    provider: Optional[str] = None,
    active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(WarmingAccount)
    if provider:
        q = q.filter(WarmingAccount.provider == provider)
    if active is not None:
        q = q.filter(WarmingAccount.active == active)
    return q.all()


@app.post("/accounts", response_model=WarmingAccountOut, dependencies=[Depends(verify_token)])
def create_account(data: WarmingAccountCreate, db: Session = Depends(get_db)):
    data = _apply_provider_defaults(data)
    existing = db.query(WarmingAccount).filter(WarmingAccount.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists")
    account = WarmingAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@app.post("/accounts/import", dependencies=[Depends(verify_token)])
async def import_accounts_csv(
    file: UploadFile,
    auto_oauth2: bool = False,
    db: Session = Depends(get_db),
):
    """
    Smart CSV import.

    Minimal CSV (only 2 columns needed):
        email,password

    Optional columns:
        provider   → auto-detected from email domain if omitted
        auth_type  → auto-set based on provider if omitted

    auto_oauth2=true: automatically fetch Outlook OAuth2 tokens during import
    (requires OUTLOOK_CLIENT_ID in .env)

    Gmail: password MUST be an App Password (16 chars, spaces optional)
    Outlook: if auto_oauth2=true, password is used to fetch token then discarded
    Firstmail: standard password, works directly
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created = 0
    oauth2_ok = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            email = row.get("email", "").strip()
            if not email:
                errors.append(f"Zeile {i+2}: Email fehlt")
                continue

            password = row.get("password", "").strip() or None

            # Auto-detect provider from email domain
            raw_provider = row.get("provider", "").strip().lower()
            provider_val = raw_provider if raw_provider in ("outlook", "gmail", "firstmail", "custom") \
                else detect_provider(email)

            # Auto-set auth_type
            raw_auth = row.get("auth_type", "").strip().lower()
            if raw_auth in ("password", "app_password", "oauth2"):
                auth_type_val = raw_auth
            elif provider_val == "gmail":
                auth_type_val = "app_password"
            elif provider_val == "outlook" and auto_oauth2:
                auth_type_val = "oauth2"
            else:
                auth_type_val = "password"

            data = WarmingAccountCreate(
                email=email,
                password=password,
                provider=ProviderEnum(provider_val),
                auth_type=AuthTypeEnum(auth_type_val),
            )
            data = _apply_provider_defaults(data)

            existing = db.query(WarmingAccount).filter(WarmingAccount.email == data.email).first()
            if existing:
                errors.append(f"Zeile {i+2}: {email} existiert bereits")
                continue

            account = WarmingAccount(**data.model_dump())

            # Auto-fetch Outlook OAuth2 token if requested
            if auto_oauth2 and provider_val == "outlook" and password:
                try:
                    tok = get_outlook_token_ropc(email, password)
                    account.oauth2_access_token = tok["access_token"]
                    account.oauth2_refresh_token = tok["refresh_token"]
                    account.oauth2_token_expiry = tok["token_expiry"]
                    account.auth_type = AuthTypeEnum.oauth2
                    account.password = None  # Don't store plain password
                    oauth2_ok += 1
                except Exception as e:
                    errors.append(f"Zeile {i+2}: OAuth2 für {email} fehlgeschlagen – {e}")
                    account.auth_type = AuthTypeEnum.password  # Fall back

            db.add(account)
            created += 1
        except Exception as e:
            errors.append(f"Zeile {i+2}: {e}")

    db.commit()
    return {"created": created, "oauth2_tokens_fetched": oauth2_ok, "errors": errors}


# ── Bulk operations ───────────────────────────────────────────────────────────

@app.post("/accounts/bulk-delete", dependencies=[Depends(verify_token)])
def bulk_delete_accounts(ids: List[int], db: Session = Depends(get_db)):
    """Delete multiple accounts by ID list."""
    deleted = db.query(WarmingAccount).filter(WarmingAccount.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


@app.post("/accounts/bulk-toggle", dependencies=[Depends(verify_token)])
def bulk_toggle_accounts(ids: List[int], active: bool, db: Session = Depends(get_db)):
    """Activate or deactivate multiple accounts."""
    updated = db.query(WarmingAccount).filter(WarmingAccount.id.in_(ids)).update(
        {"active": active}, synchronize_session=False
    )
    db.commit()
    return {"updated": updated}


@app.post("/accounts/bulk-oauth2", dependencies=[Depends(verify_token)])
def bulk_fetch_oauth2_tokens(db: Session = Depends(get_db)):
    """
    Fetch Outlook OAuth2 tokens for all Outlook accounts that still use
    password auth and have a stored password.
    Returns per-account results.
    """
    accounts = db.query(WarmingAccount).filter(
        WarmingAccount.provider == ProviderEnum.outlook,
        WarmingAccount.auth_type == AuthTypeEnum.password,
        WarmingAccount.password != None,
    ).all()

    results = []
    for acc in accounts:
        try:
            tok = get_outlook_token_ropc(acc.email, acc.password)
            acc.oauth2_access_token = tok["access_token"]
            acc.oauth2_refresh_token = tok["refresh_token"]
            acc.oauth2_token_expiry = tok["token_expiry"]
            acc.auth_type = AuthTypeEnum.oauth2
            acc.password = None
            results.append({"email": acc.email, "status": "ok"})
        except Exception as e:
            results.append({"email": acc.email, "status": "error", "detail": str(e)})

    db.commit()
    return {"processed": len(results), "results": results}


@app.post("/accounts/{account_id}/fetch-oauth2", dependencies=[Depends(verify_token)])
def fetch_single_oauth2_token(account_id: int, db: Session = Depends(get_db)):
    """Fetch Outlook OAuth2 token for a single account (must have password stored)."""
    account = db.get(WarmingAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.provider != ProviderEnum.outlook:
        raise HTTPException(status_code=400, detail="Only Outlook accounts support ROPC OAuth2")
    if not account.password:
        raise HTTPException(status_code=400, detail="No password stored for this account")

    tok = get_outlook_token_ropc(account.email, account.password)
    account.oauth2_access_token = tok["access_token"]
    account.oauth2_refresh_token = tok["refresh_token"]
    account.oauth2_token_expiry = tok["token_expiry"]
    account.auth_type = AuthTypeEnum.oauth2
    account.password = None
    db.commit()
    return {"status": "ok", "email": account.email}


@app.get("/accounts/{account_id}", response_model=WarmingAccountOut, dependencies=[Depends(verify_token)])
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(WarmingAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.put("/accounts/{account_id}", response_model=WarmingAccountOut, dependencies=[Depends(verify_token)])
def update_account(account_id: int, data: WarmingAccountUpdate, db: Session = Depends(get_db)):
    account = db.get(WarmingAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


@app.delete("/accounts/{account_id}", dependencies=[Depends(verify_token)])
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(WarmingAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"status": "deleted"}


@app.post("/accounts/{account_id}/test", dependencies=[Depends(verify_token)])
def test_account_connection(account_id: int, db: Session = Depends(get_db)):
    account = db.get(WarmingAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return test_connection(account)


# ── Campaigns ─────────────────────────────────────────────────────────────────

@app.get("/campaigns", response_model=List[CampaignOut], dependencies=[Depends(verify_token)])
def list_campaigns(db: Session = Depends(get_db)):
    return db.query(WarmingCampaign).all()


@app.post("/campaigns", response_model=CampaignOut, dependencies=[Depends(verify_token)])
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    campaign = WarmingCampaign(**data.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@app.get("/campaigns/{campaign_id}", response_model=CampaignOut, dependencies=[Depends(verify_token)])
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@app.delete("/campaigns/{campaign_id}", dependencies=[Depends(verify_token)])
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"status": "deleted"}


@app.post("/campaigns/{campaign_id}/start", response_model=CampaignOut, dependencies=[Depends(verify_token)])
def start_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatusEnum.active
    campaign.start_date = campaign.start_date or datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    return campaign


@app.post("/campaigns/{campaign_id}/pause", response_model=CampaignOut, dependencies=[Depends(verify_token)])
def pause_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatusEnum.paused
    db.commit()
    db.refresh(campaign)
    return campaign


@app.post("/campaigns/{campaign_id}/stop", response_model=CampaignOut, dependencies=[Depends(verify_token)])
def stop_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatusEnum.stopped
    db.commit()
    db.refresh(campaign)
    return campaign


@app.post("/campaigns/{campaign_id}/run-now", dependencies=[Depends(verify_token)])
def run_campaign_now(campaign_id: int, db: Session = Depends(get_db)):
    """Manually trigger today's warming run for a campaign."""
    from .tasks import enqueue_warming_task
    from .warming_engine import calculate_emails_today, get_warming_pairs

    campaign = db.get(WarmingCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    count = calculate_emails_today(campaign)
    pairs = get_warming_pairs(db, campaign, count)

    enqueued = 0
    import random
    for account, domain_email in pairs:
        delay_seconds = random.randint(0, 30 * 60)
        enqueue_warming_task(
            "send_warming_email",
            account.id,
            domain_email.id,
            campaign_id,
            delay_seconds=delay_seconds,
        )
        enqueued += 1

    return {"enqueued": enqueued, "emails_planned": count}


# ── Logs ──────────────────────────────────────────────────────────────────────

@app.get("/campaigns/{campaign_id}/logs", response_model=List[WarmingLogOut], dependencies=[Depends(verify_token)])
def get_campaign_logs(
    campaign_id: int,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(WarmingLog).filter(WarmingLog.campaign_id == campaign_id)
    if status:
        q = q.filter(WarmingLog.status == status)
    return q.order_by(WarmingLog.created_at.desc()).offset(offset).limit(limit).all()


@app.get("/logs", response_model=List[WarmingLogOut], dependencies=[Depends(verify_token)])
def get_all_logs(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(WarmingLog)
    if status:
        q = q.filter(WarmingLog.status == status)
    return q.order_by(WarmingLog.created_at.desc()).offset(offset).limit(limit).all()


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/dashboard/stats", response_model=DashboardStats, dependencies=[Depends(verify_token)])
def get_dashboard_stats(db: Session = Depends(get_db)):
    from datetime import date

    today_start = datetime.combine(date.today(), datetime.min.time())

    total_domains = db.query(func.count(Domain.id)).scalar()
    total_domain_emails = db.query(func.count(DomainEmail.id)).scalar()
    total_accounts = db.query(func.count(WarmingAccount.id)).scalar()
    active_campaigns = db.query(func.count(WarmingCampaign.id)).filter(
        WarmingCampaign.status == CampaignStatusEnum.active
    ).scalar()

    today_logs = db.query(WarmingLog).filter(WarmingLog.created_at >= today_start)
    sent_today = today_logs.filter(WarmingLog.sent_at != None).count()
    opened_today = today_logs.filter(WarmingLog.opened_at != None).count()
    replied_today = today_logs.filter(WarmingLog.replied_at != None).count()

    open_rate = round(opened_today / sent_today * 100, 1) if sent_today > 0 else 0.0
    reply_rate = round(replied_today / sent_today * 100, 1) if sent_today > 0 else 0.0

    return DashboardStats(
        total_domains=total_domains,
        total_domain_emails=total_domain_emails,
        total_warming_accounts=total_accounts,
        active_campaigns=active_campaigns,
        emails_sent_today=sent_today,
        emails_opened_today=opened_today,
        emails_replied_today=replied_today,
        open_rate=open_rate,
        reply_rate=reply_rate,
    )


@app.get("/dashboard/daily-stats", response_model=List[DailyStatPoint], dependencies=[Depends(verify_token)])
def get_daily_stats(days: int = 14, db: Session = Depends(get_db)):
    """Return per-day email statistics for the last N days."""
    from datetime import date, timedelta

    result = []
    today = date.today()
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())

        base = db.query(WarmingLog).filter(
            WarmingLog.created_at >= day_start,
            WarmingLog.created_at <= day_end,
        )
        sent = base.filter(WarmingLog.sent_at != None).count()
        opened = base.filter(WarmingLog.opened_at != None).count()
        replied = base.filter(WarmingLog.replied_at != None).count()
        errors = base.filter(WarmingLog.status == "error").count()

        result.append(DailyStatPoint(
            date=day.strftime("%d.%m"),
            sent=sent,
            opened=opened,
            replied=replied,
            errors=errors,
        ))
    return result


# ── Reputation ────────────────────────────────────────────────────────────────

@app.get("/domains/{domain_id}/reputation", response_model=DomainReputation, dependencies=[Depends(verify_token)])
def get_domain_reputation(domain_id: int, db: Session = Depends(get_db)):
    """Run free DNS-based reputation check on a domain."""
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return check_domain_reputation(domain.name)


@app.get("/reputation/check", response_model=DomainReputation, dependencies=[Depends(verify_token)])
def check_reputation_by_name(domain: str):
    """Check reputation for any domain name (query param)."""
    return check_domain_reputation(domain)
