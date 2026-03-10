"""
RQ task definitions for domain warming.
All tasks run in background workers.
"""

import os
import random
from datetime import datetime

import redis
from rq import Queue
from rq.job import Job

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_conn = redis.from_url(REDIS_URL)
q = Queue(connection=redis_conn)


def enqueue_warming_task(task_name: str, *args, delay_seconds: int = 0, **kwargs):
    """Enqueue a warming task with optional delay."""
    func = {
        "send_warming_email": send_warming_email,
        "check_domain_inbox": check_domain_inbox,
        "check_warming_account_inbox": check_warming_account_inbox,
        "run_daily_scheduler": run_daily_scheduler_task,
    }.get(task_name)

    if func is None:
        raise ValueError(f"Unknown task: {task_name}")

    if delay_seconds > 0:
        from datetime import timedelta
        q.enqueue_in(timedelta(seconds=delay_seconds), func, *args, **kwargs)
    else:
        q.enqueue(func, *args, **kwargs)


# ── Task implementations ─────────────────────────────────────────────────────

def send_warming_email(warming_account_id: int, domain_email_id: int, campaign_id: int):
    """Task: Send warming email from warming account to domain email."""
    from .database import SessionLocal
    from .email_service import send_random_warming_email
    from .models import DomainEmail, LogStatusEnum, WarmingAccount, WarmingLog

    db = SessionLocal()
    try:
        account = db.get(WarmingAccount, warming_account_id)
        domain_email = db.get(DomainEmail, domain_email_id)

        if not account or not domain_email:
            return {"error": "Account or domain email not found"}

        subject, message_id = send_random_warming_email(account, domain_email.email)

        log = WarmingLog(
            campaign_id=campaign_id,
            warming_account_id=warming_account_id,
            domain_email_id=domain_email_id,
            subject=subject,
            message_id=message_id,
            status=LogStatusEnum.sent,
            sent_at=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Schedule domain inbox check after 5–30 min
        delay = random.randint(5 * 60, 30 * 60)
        enqueue_warming_task(
            "check_domain_inbox",
            domain_email_id,
            warming_account_id,
            campaign_id,
            log.id,
            delay_seconds=delay,
        )

        return {"status": "sent", "log_id": log.id, "subject": subject}

    except Exception as e:
        db.rollback()
        # Log error
        try:
            error_log = WarmingLog(
                campaign_id=campaign_id,
                warming_account_id=warming_account_id,
                domain_email_id=domain_email_id,
                status=LogStatusEnum.error,
                error_message=str(e),
            )
            db.add(error_log)
            db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


def check_domain_inbox(
    domain_email_id: int,
    warming_account_id: int,
    campaign_id: int,
    log_id: int,
):
    """Task: Domain email checks inbox, marks as read, sends reply."""
    from .database import SessionLocal
    from .email_service import check_inbox_for_message, mark_as_read, reply_to_email
    from .models import DomainEmail, LogStatusEnum, WarmingAccount, WarmingLog

    db = SessionLocal()
    try:
        domain_email = db.get(DomainEmail, domain_email_id)
        account = db.get(WarmingAccount, warming_account_id)
        log = db.get(WarmingLog, log_id)

        if not domain_email or not account or not log:
            return {"error": "Not found"}

        messages = check_inbox_for_message(domain_email, "UNSEEN")

        # Find the matching message
        target = None
        for msg in messages:
            if log.message_id and log.message_id in msg.get("message_id", ""):
                target = msg
                break
        if not target and messages:
            target = messages[-1]

        if target:
            mark_as_read(domain_email, target["uid"])
            log.received_at = datetime.utcnow()
            log.opened_at = datetime.utcnow()
            log.status = LogStatusEnum.opened

            # Send reply from domain email back to warming account
            reply_msg_id = reply_to_email(
                domain_email,
                target["subject"],
                target["message_id"],
                account.email,
            )

            log.replied_at = datetime.utcnow()
            log.status = LogStatusEnum.replied
            db.commit()

            # Schedule warming account inbox check after 10–60 min
            delay = random.randint(10 * 60, 60 * 60)
            enqueue_warming_task(
                "check_warming_account_inbox",
                warming_account_id,
                domain_email_id,
                campaign_id,
                log_id,
                reply_msg_id,
                target["subject"],
                delay_seconds=delay,
            )
            return {"status": "replied", "log_id": log_id}
        else:
            # No message found in inbox – mark log as error
            log.status = LogStatusEnum.error
            log.error_message = "Domain-Posteingang: keine passende E-Mail gefunden (evtl. noch nicht zugestellt)"
            db.commit()
            return {"status": "not_found", "log_id": log_id}

    except Exception as e:
        db.rollback()
        if log_id:
            try:
                log = db.get(WarmingLog, log_id)
                if log:
                    log.status = LogStatusEnum.error
                    log.error_message = str(e)
                    db.commit()
            except Exception:
                pass
        raise
    finally:
        db.close()


def check_warming_account_inbox(
    warming_account_id: int,
    domain_email_id: int,
    campaign_id: int,
    log_id: int,
    expected_message_id: str,
    original_subject: str,
):
    """Task: Warming account checks inbox, marks reply as read, sends reply back."""
    from .database import SessionLocal
    from .email_service import check_inbox_for_message, mark_as_read, reply_to_email
    from .models import DomainEmail, LogStatusEnum, WarmingAccount, WarmingLog

    db = SessionLocal()
    try:
        account = db.get(WarmingAccount, warming_account_id)
        domain_email = db.get(DomainEmail, domain_email_id)
        log = db.get(WarmingLog, log_id)

        if not account or not domain_email or not log:
            return {"error": "Not found"}

        messages = check_inbox_for_message(account, "UNSEEN")

        target = None
        for msg in messages:
            if msg.get("in_reply_to") == expected_message_id or \
               domain_email.email in msg.get("from", ""):
                target = msg
                break
        if not target and messages:
            target = messages[-1]

        if target:
            mark_as_read(account, target["uid"])

            # Send another reply back to complete the conversation loop
            reply_to_email(
                account,
                target["subject"],
                target["message_id"],
                domain_email.email,
            )

            log.status = LogStatusEnum.replied
            db.commit()
            return {"status": "completed", "log_id": log_id}
        else:
            # No reply found – mark log as error so dashboard shows it
            log.status = LogStatusEnum.error
            log.error_message = "Warming-Account-Posteingang: keine Antwort gefunden"
            db.commit()
            return {"status": "not_found", "log_id": log_id}

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def run_daily_scheduler_task():
    """Task: Run the daily warming scheduler for all active campaigns."""
    from .database import SessionLocal
    from .warming_engine import run_daily_scheduler

    db = SessionLocal()
    try:
        summary = run_daily_scheduler(db)
        return summary
    finally:
        db.close()
