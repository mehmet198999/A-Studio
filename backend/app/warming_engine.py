"""
Core domain warming logic.
Calculates daily email volume and orchestrates warming tasks.
"""

import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .models import (
    CampaignStatusEnum,
    DomainEmail,
    LogStatusEnum,
    WarmingAccount,
    WarmingCampaign,
    WarmingLog,
)


def calculate_emails_today(campaign: WarmingCampaign) -> int:
    """
    Calculate how many emails to send today.
    During start_delay_days: return 0 (preparation phase, no sends).
    After delay: ramp up linearly from start to max over ramp_up_days.
    """
    delay = getattr(campaign, "start_delay_days", 0)
    day = campaign.current_day

    if day < delay:
        return 0  # Preparation phase – no emails yet

    effective_day = day - delay
    if effective_day >= campaign.ramp_up_days:
        return campaign.emails_per_day_max

    ratio = effective_day / campaign.ramp_up_days
    count = campaign.emails_per_day_start + int(
        (campaign.emails_per_day_max - campaign.emails_per_day_start) * ratio
    )
    return max(1, count)


def get_warming_pairs(db: Session, campaign: WarmingCampaign, count: int) -> list[tuple]:
    """
    Select random (warming_account, domain_email) pairs for today's warming run.
    Avoids pairs already used today.
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Already used warming account IDs today for this campaign
    used_ids = {
        row.warming_account_id
        for row in db.query(WarmingLog.warming_account_id)
        .filter(
            WarmingLog.campaign_id == campaign.id,
            WarmingLog.created_at >= today_start,
        )
        .all()
    }

    accounts = (
        db.query(WarmingAccount)
        .filter(WarmingAccount.active == True)
        .all()
    )
    domain_emails = db.query(DomainEmail).all()

    if not accounts or not domain_emails:
        return []

    # Prefer accounts not yet used today
    available = [a for a in accounts if a.id not in used_ids] or accounts
    random.shuffle(available)

    pairs = []
    for i in range(min(count, len(available))):
        account = available[i % len(available)]
        domain_email = random.choice(domain_emails)
        pairs.append((account, domain_email))

    return pairs


def create_log_entry(
    db: Session,
    campaign_id: int,
    warming_account_id: int,
    domain_email_id: int,
    subject: str = None,
    message_id: str = None,
    status: LogStatusEnum = LogStatusEnum.sent,
) -> WarmingLog:
    log = WarmingLog(
        campaign_id=campaign_id,
        warming_account_id=warming_account_id,
        domain_email_id=domain_email_id,
        subject=subject,
        message_id=message_id,
        status=status,
        sent_at=datetime.utcnow() if status == LogStatusEnum.sent else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def run_daily_scheduler(db: Session) -> dict:
    """
    Main scheduler: runs once per day for each active campaign.
    Enqueues email tasks for all pairs.
    Returns summary.
    """
    from .tasks import enqueue_warming_task

    active_campaigns = (
        db.query(WarmingCampaign)
        .filter(WarmingCampaign.status == CampaignStatusEnum.active)
        .all()
    )

    summary = {"campaigns_processed": 0, "tasks_enqueued": 0}

    for campaign in active_campaigns:
        count = calculate_emails_today(campaign)
        pairs = get_warming_pairs(db, campaign, count)

        for account, domain_email in pairs:
            # Spread sends over the day: random delay 0–8 hours
            delay_seconds = random.randint(0, 8 * 3600)
            enqueue_warming_task(
                "send_warming_email",
                account.id,
                domain_email.id,
                campaign.id,
                delay_seconds=delay_seconds,
            )
            summary["tasks_enqueued"] += 1

        # Advance campaign day
        campaign.current_day += 1
        if campaign.current_day >= campaign.ramp_up_days:
            campaign.current_day = campaign.ramp_up_days
        db.commit()
        summary["campaigns_processed"] += 1

    return summary
