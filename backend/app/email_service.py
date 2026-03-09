"""
Email service for IMAP/SMTP operations.
Supports password auth, app passwords, and OAuth2 (Gmail & Outlook).
"""

import base64
import email as email_lib
import imaplib
import random
import smtplib
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests

# ── Provider defaults ────────────────────────────────────────────────────────

PROVIDER_SETTINGS = {
    "outlook": {
        "smtp_host": "smtp-mail.outlook.com",
        "smtp_port": 587,
        "imap_host": "imap-mail.outlook.com",
        "imap_port": 993,
    },
    "gmail": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
    },
    "firstmail": {
        "smtp_host": "smtp.firstmail.ltd",
        "smtp_port": 587,
        "imap_host": "imap.firstmail.ltd",
        "imap_port": 993,
    },
    "custom": {
        "smtp_host": "",
        "smtp_port": 587,
        "imap_host": "",
        "imap_port": 993,
    },
}

# ── OAuth2 token refresh ─────────────────────────────────────────────────────

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"


def _refresh_google_token(refresh_token: str, client_id: str, client_secret: str) -> dict:
    resp = requests.post(GOOGLE_TOKEN_URL, data={
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _refresh_microsoft_token(refresh_token: str, client_id: str, client_secret: str) -> dict:
    resp = requests.post(MICROSOFT_TOKEN_URL, data={
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://outlook.office.com/IMAP.AccessAsUser.All "
                 "https://outlook.office.com/SMTP.Send offline_access",
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_valid_access_token(account) -> str:
    """Return a valid access token, refreshing if needed. Updates DB object in place."""
    if account.oauth2_token_expiry and account.oauth2_token_expiry > datetime.utcnow():
        return account.oauth2_access_token

    if not account.oauth2_refresh_token:
        raise ValueError(f"No refresh token for account {account.email}")

    if account.provider == "gmail":
        data = _refresh_google_token(
            account.oauth2_refresh_token,
            account.oauth2_client_id,
            account.oauth2_client_secret,
        )
    elif account.provider == "outlook":
        data = _refresh_microsoft_token(
            account.oauth2_refresh_token,
            account.oauth2_client_id,
            account.oauth2_client_secret,
        )
    else:
        raise ValueError(f"OAuth2 not supported for provider {account.provider}")

    from datetime import timedelta
    account.oauth2_access_token = data["access_token"]
    account.oauth2_token_expiry = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600) - 60)
    if "refresh_token" in data:
        account.oauth2_refresh_token = data["refresh_token"]
    return account.oauth2_access_token


def _build_xoauth2_string(email: str, access_token: str) -> str:
    raw = f"user={email}\x01auth=Bearer {access_token}\x01\x01"
    return base64.b64encode(raw.encode()).decode()


# ── SMTP helpers ─────────────────────────────────────────────────────────────

def _get_smtp(account) -> smtplib.SMTP:
    smtp = smtplib.SMTP(account.smtp_host, account.smtp_port, timeout=30)
    smtp.ehlo()
    smtp.starttls()
    smtp.ehlo()

    if account.auth_type == "oauth2":
        access_token = get_valid_access_token(account)
        xoauth2 = _build_xoauth2_string(account.email, access_token)
        smtp.docmd("AUTH", f"XOAUTH2 {xoauth2}")
    else:
        smtp.login(account.email, account.password)

    return smtp


# ── IMAP helpers ─────────────────────────────────────────────────────────────

def _get_imap(account) -> imaplib.IMAP4_SSL:
    imap = imaplib.IMAP4_SSL(account.imap_host, account.imap_port)

    if account.auth_type == "oauth2":
        access_token = get_valid_access_token(account)
        xoauth2 = _build_xoauth2_string(account.email, access_token)
        imap.authenticate("XOAUTH2", lambda _: xoauth2)
    else:
        imap.login(account.email, account.password)

    return imap


# ── Core email operations ─────────────────────────────────────────────────────

WARMING_SUBJECTS = [
    "Guten Morgen! Kurze Anfrage",
    "Rückfrage zu unserem letzten Gespräch",
    "Interessante Neuigkeiten für Sie",
    "Kurze Mitteilung",
    "Haben Sie einen Moment?",
    "Follow-up zu unserer Unterhaltung",
    "Wichtige Information",
    "Kurze Frage",
    "Update für Sie",
    "Schnelle Rückmeldung erbeten",
]

WARMING_BODIES = [
    "Hallo,\n\nIch wollte mich kurz melden und fragen, wie es Ihnen geht. Ich freue mich auf Ihre Rückmeldung.\n\nMit freundlichen Grüßen",
    "Guten Tag,\n\nKurze Nachfrage zu unserem letzten Austausch. Haben Sie alle benötigten Informationen erhalten?\n\nBeste Grüße",
    "Hallo,\n\nIch hoffe, diese Nachricht findet Sie gut. Ich wollte nur kurz nachfragen ob alles in Ordnung ist.\n\nFreundliche Grüße",
    "Sehr geehrte Damen und Herren,\n\nIch melde mich bezüglich unserer letzten Kommunikation. Ich würde mich über eine Rückmeldung freuen.\n\nMit besten Grüßen",
    "Hallo,\n\nIch wollte Sie auf dem Laufenden halten. Bitte lassen Sie mich wissen wenn Sie Fragen haben.\n\nViele Grüße",
]

REPLY_BODIES = [
    "Vielen Dank für Ihre Nachricht! Ich habe alles erhalten und melde mich bald zurück.\n\nMit freundlichen Grüßen",
    "Danke für Ihre E-Mail! Ich kümmere mich darum und komme in Kürze auf Sie zu.\n\nBeste Grüße",
    "Guten Tag, vielen Dank für die Rückmeldung. Das ist sehr hilfreich.\n\nMit freundlichen Grüßen",
    "Hallo, danke für die schnelle Antwort! Ich habe alles verstanden.\n\nFreundliche Grüße",
]


def send_email(account, to_email: str, subject: str, body: str) -> str:
    """Send email via SMTP. Returns message-id."""
    msg = MIMEMultipart("alternative")
    msg["From"] = account.email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Message-ID"] = email_lib.utils.make_msgid(domain=account.email.split("@")[1])
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with _get_smtp(account) as smtp:
        smtp.send_message(msg)

    return msg["Message-ID"]


def send_random_warming_email(account, to_email: str) -> tuple[str, str]:
    """Send a random warming email. Returns (subject, message_id)."""
    subject = random.choice(WARMING_SUBJECTS)
    body = random.choice(WARMING_BODIES)
    message_id = send_email(account, to_email, subject, body)
    return subject, message_id


def reply_to_email(account, original_subject: str, original_message_id: str, to_email: str) -> str:
    """Send a reply to an email. Returns new message-id."""
    subject = f"Re: {original_subject}" if not original_subject.startswith("Re:") else original_subject
    body = random.choice(REPLY_BODIES)

    msg = MIMEMultipart("alternative")
    msg["From"] = account.email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["In-Reply-To"] = original_message_id
    msg["References"] = original_message_id
    msg["Message-ID"] = email_lib.utils.make_msgid(domain=account.email.split("@")[1])
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with _get_smtp(account) as smtp:
        smtp.send_message(msg)

    return msg["Message-ID"]


def check_inbox_for_message(account, search_criteria: str = "UNSEEN") -> list[dict]:
    """Check IMAP inbox for messages matching criteria. Returns list of message dicts."""
    messages = []
    try:
        imap = _get_imap(account)
        imap.select("INBOX")

        _, data = imap.search(None, search_criteria)
        msg_ids = data[0].split() if data[0] else []

        for num in msg_ids[-20:]:  # limit to last 20 unseen
            _, msg_data = imap.fetch(num, "(RFC822)")
            raw = msg_data[0][1]
            parsed = email_lib.message_from_bytes(raw)
            messages.append({
                "uid": num.decode(),
                "subject": parsed.get("Subject", ""),
                "from": parsed.get("From", ""),
                "message_id": parsed.get("Message-ID", ""),
                "in_reply_to": parsed.get("In-Reply-To", ""),
            })

        imap.logout()
    except Exception as e:
        raise RuntimeError(f"IMAP error for {account.email}: {e}")

    return messages


def mark_as_read(account, uid: str) -> None:
    """Mark an email as read via IMAP."""
    imap = _get_imap(account)
    imap.select("INBOX")
    imap.store(uid, "+FLAGS", "\\Seen")
    imap.logout()


def test_connection(account) -> dict:
    """Test SMTP and IMAP connectivity. Returns status dict."""
    results = {"smtp": False, "imap": False, "smtp_error": None, "imap_error": None}
    try:
        with _get_smtp(account):
            results["smtp"] = True
    except Exception as e:
        results["smtp_error"] = str(e)

    try:
        imap = _get_imap(account)
        imap.logout()
        results["imap"] = True
    except Exception as e:
        results["imap_error"] = str(e)

    return results
